/**
 * Niveau 12 — détection d’intention sociale (WhatsApp humain vs bot support).
 */

import { norm } from "@/lib/agents/seller-language";
import { isProspectGreetingMessage } from "@/lib/agents/human-behavior/conversation-state-engine";

export type SocialIntentKind =
  | "simple_greeting"
  | "social_chat"
  | "personal_question"
  | "humor"
  | "teasing"
  | "curiosity"
  | "identity_request"
  | "product_request"
  | "purchase"
  | "frustration"
  | "complaint"
  | "general";

const PERSONAL_Q =
  /\b(tu\s+fais\s+quoi|vous\s+faites\s+quoi|qu['’]?est[- ]ce que tu fais|qu['’]?est[- ]ce que vous faites|tu\s+es\s+en\s+train\s+de\s+quoi|vous\s+êtes\s+en\s+train\s+de\s+quoi|t['’]?es\s+où|tu\s+es\s+où|vous\s+êtes\s+où|tu\s+travailles|vous\s+travaillez|tu\s+bosses|encore\s+au\s+bureau|encore\s+au\s+magasin|what\s+are\s+you\s+doing|where\s+are\s+you|still\s+at\s+work|still\s+at\s+the\s+(shop|store|office)|qué\s+haces|qué\s+estás\s+haciendo|dónde\s+estás)\b/i;

const SOCIAL_CHAT =
  /\b(ça\s+va\s+la\s+vie|la\s+forme|tu\s+vas\s+bien|vous\s+allez\s+bien|quoi\s+de\s+neuf|what'?s\s+up|how'?s\s+it\s+going|qué\s+tal\s+amigo|tu\s+fais\s+la\s+fête)\b/i;

const HUMOR = /\b(lol|mdr|ptdr|haha|😂|🤣|je\s+rigole|tu\s+me\s+fais\s+rire)\b/i;
const TEASING = /\b(tu\s+vas\s+finir\s+par\s+me\s+convaincre|arrête\s+de\s+vendre|stop\s+selling|ya\s+plus\s+personne)\b/i;

const IDENTITY_REQUEST =
  /\b(tu\s+es\s+qui|qui\s+es[\s-]?tu|c['']?est\s+quoi\s+ton\s+r[ôo]le|quel\s+est\s+ton\s+r[ôo]le|tu\s+travailles\s+pour\s+qui|tu\s+bosses\s+pour\s+qui|vous\s+êtes\s+qui|qui\s+êtes[\s-]?vous|c['']?est\s+quoi\s+ton\s+(boulot|job|travail)|who\s+are\s+you|what['']?s\s+your\s+(role|job)|who\s+do\s+you\s+work\s+for|qui[eé]n\s+eres|cu[aá]l\s+es\s+tu\s+(rol|trabajo))\b/i;

const PRODUCT =
  /\b(prix|stock|dispo|disponible|livraison|commander|acheter|modèle|taille|couleur|article|iphone|samsung|nike|have\s+you\s+got|do\s+you\s+have|precio|disponible|pedido)\b/i;

const PURCHASE = /\b(je\s+prends|je\s+commande|je\s+veux\s+l['’']?acheter|i['’']?ll\s+take|quiero\s+comprar)\b/i;

const FRUSTRATION = /\b(énerv|frustr|marre|ras\s+le|trop\s+cher|arnaque|scam|honte)\b/i;
const COMPLAINT = /\b(réclamation|plainte|rembours|retour|inadmissible|tribunal)\b/i;

function mentionsAgentByName(message: string, agentName?: string | null): boolean {
  const name = String(agentName ?? "").trim();
  if (!name || name.length < 2) return false;
  const n = norm(name).toLowerCase();
  return new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(norm(message).toLowerCase());
}

export type SocialIntentResult = {
  kind: SocialIntentKind;
  /** Conversation déjà engagée — interdit accueil / bienvenue */
  blockWelcomeReplay: boolean;
  /** Pas de mode support client ce tour */
  forbidSupportMode: boolean;
};

export function detectSocialIntent(
  message: string,
  opts?: { agentName?: string | null; turnCount?: number; welcomeAlreadyDelivered?: boolean },
): SocialIntentResult {
  const raw = String(message ?? "").trim();
  const t = norm(raw).toLowerCase();
  const turn = opts?.turnCount ?? 0;
  const welcomeDone = opts?.welcomeAlreadyDelivered === true || turn >= 2;

  if (!t) {
    return { kind: "general", blockWelcomeReplay: welcomeDone, forbidSupportMode: false };
  }

  if (COMPLAINT.test(t)) {
    return { kind: "complaint", blockWelcomeReplay: true, forbidSupportMode: false };
  }
  if (FRUSTRATION.test(t)) {
    return { kind: "frustration", blockWelcomeReplay: true, forbidSupportMode: true };
  }
  if (PURCHASE.test(t)) {
    return { kind: "purchase", blockWelcomeReplay: true, forbidSupportMode: false };
  }
  if (PRODUCT.test(t)) {
    return { kind: "product_request", blockWelcomeReplay: true, forbidSupportMode: false };
  }
  if (IDENTITY_REQUEST.test(t)) {
    console.log("[IDENTITY_REQUEST_DETECTED]", { message: raw.slice(0, 80), kind: "identity_request" });
    return { kind: "identity_request", blockWelcomeReplay: true, forbidSupportMode: true };
  }
  if (PERSONAL_Q.test(t) || (mentionsAgentByName(raw, opts?.agentName) && /\?/.test(raw) && t.length < 80)) {
    return { kind: "personal_question", blockWelcomeReplay: true, forbidSupportMode: true };
  }
  if (TEASING.test(t)) {
    return { kind: "teasing", blockWelcomeReplay: true, forbidSupportMode: true };
  }
  if (HUMOR.test(t)) {
    return { kind: "humor", blockWelcomeReplay: true, forbidSupportMode: true };
  }
  if (SOCIAL_CHAT.test(t)) {
    return { kind: "social_chat", blockWelcomeReplay: welcomeDone, forbidSupportMode: true };
  }

  if (isGreetingOnlyMessage(raw)) {
    return {
      kind: "simple_greeting",
      blockWelcomeReplay: welcomeDone,
      forbidSupportMode: welcomeDone,
    };
  }

  if (isProspectGreetingMessage(raw) && !PERSONAL_Q.test(t)) {
    return {
      kind: "social_chat",
      blockWelcomeReplay: welcomeDone,
      forbidSupportMode: true,
    };
  }

  if (/\?/.test(t) && t.length < 90 && !PRODUCT.test(t)) {
    return { kind: "curiosity", blockWelcomeReplay: welcomeDone, forbidSupportMode: true };
  }

  return { kind: "general", blockWelcomeReplay: welcomeDone, forbidSupportMode: false };
}

/** Salutation seule — pas « Hey Axel tu fais quoi ? » */
export function isGreetingOnlyMessage(message: string): boolean {
  const raw = String(message ?? "").trim();
  if (!isProspectGreetingMessage(raw)) return false;
  const t = norm(raw).toLowerCase();
  if (PERSONAL_Q.test(t) || PRODUCT.test(t) || PURCHASE.test(t)) return false;
  if (/\b(tu\s+fais|vous\s+faites|comment\s+tu|what\s+are\s+you|qué\s+haces)\b/i.test(t)) return false;

  const withoutLead = t
    .replace(/^(hey|hi|hello|salut|coucou|cc|bonjour|bonsoir|hola|buenos\s+d[ií]as)\s*/i, "")
    .replace(/[.!?…]+$/g, "")
    .trim();
  if (withoutLead.length > 22) return false;
  if (/\?/.test(t) && withoutLead.length > 8) return false;
  return true;
}

export function formatSocialIntentPromptBlock(result: SocialIntentResult, lang: "fr" | "en" | "es"): string {
  const forbidWelcome =
    result.blockWelcomeReplay &&
    (result.kind === "personal_question" ||
      result.kind === "social_chat" ||
      result.kind === "humor" ||
      result.kind === "teasing" ||
      result.kind === "curiosity");

  if (lang === "en") {
    return [
      `SOCIAL INTENT (level 12): ${result.kind}`,
      result.forbidSupportMode ? "- FORBIDDEN this turn: welcome script, “how can I help”, corporate intro, product pitch." : null,
      forbidWelcome ? "- FORBIDDEN: “welcome to …”, business presentation, first-contact opener — conversation already live." : null,
      result.kind === "personal_question"
        ? "- They asked what you’re doing — answer like a real person at work (short), not a support bot."
        : result.kind === "identity_request"
          ? "- They asked who you are / your role — answer naturally: name + company + what you do."
          : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (lang === "es") {
    return [
      `INTENCIÓN SOCIAL: ${result.kind}`,
      result.forbidSupportMode ? "- Prohibido: bienvenida corporativa, «en qué puedo ayudarle», pitch." : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `INTENTION SOCIALE (niveau 12) : ${result.kind}`,
    result.forbidSupportMode
      ? "- INTERDIT ce tour : script d’accueil, « comment puis-je vous aider », présentation entreprise, forcing produit."
      : null,
    forbidWelcome
      ? "- INTERDIT : « bienvenue chez … », message d’accueil, intro premier contact — la conversation est déjà engagée."
      : null,
    result.kind === "personal_question"
      ? "- Question personnelle (« tu fais quoi ? ») : répondre comme une vraie personne au travail — court, naturel — pas support."
      : result.kind === "identity_request"
        ? "- Demande d'identité (« tu es qui ? ») : répondre avec nom + entreprise + rôle — naturel, pas commercial."
        : result.kind === "social_chat"
        ? "- Discussion sociale : ton WhatsApp réel, pas standard téléphonique."
        : null,
  ]
    .filter(Boolean)
    .join("\n");
}
