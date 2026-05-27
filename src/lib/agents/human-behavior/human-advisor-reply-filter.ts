import "server-only";

import { isStrongNegativeEmotionalTurn } from "./emotions/conversation-emotion";
import { norm } from "@/lib/agents/seller-language";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

/** Réponses « secrétaire / ticket » à éviter en sortie (insensible à la casse). */
const COLD_ACK_WHOLE_LINE = /^(bien\s+reçu|bien\s+recu|noté|c'est\s+noté|c\s*est\s+noté|compris|d'accord|dac|ok|okay)\.?$/i;

const GENERIC_HELP_FR =
  /^(que\s+puis-je\s+faire\s+pour\s+vous|comment\s+puis-je\s+vous\s+aider|comment\s+puis-je\s+vous\s+assister|comment\s+puis-je\s+t['’]aider|en\s+quoi\s+puis-je)/i;
const GENERIC_HELP_EN = /^(how\s+can\s+i\s+help|what\s+can\s+i\s+do\s+for\s+you|how\s+may\s+i\s+help)/i;

const GENERIC_PRODUCT_Q_FR =
  /\b(quel\s+produit\s+recherchez|que\s+recherchez-vous\s+exactement|quel\s+modèle\s+cherchez|vous\s+cherchez\s+quoi)\b/i;
const GENERIC_PRODUCT_Q_EN = /\b(what\s+product\s+are\s+you\s+looking|which\s+model\s+are\s+you\s+after)\b/i;

function looksFr(text: string) {
  return /\b(bonjour|monsieur|madame|merci|vous|chez)\b/i.test(text);
}

function extractProductFocusFromState(state?: SellerBehaviorConversationState): string | null {
  const f = state?.productMemory?.lastProductFocus?.trim();
  if (f) return f.slice(0, 90);
  const lines = Array.isArray(state?.memory) ? state!.memory!.map(String) : [];
  for (const line of lines) {
    const m = line.match(/^(Couleur|Produit|Préférence)\s*:\s*(.+)$/i);
    if (m?.[2]) return String(m[2]).trim().slice(0, 90);
  }
  const vp = state?.productMemory?.viewedProducts?.[0];
  return vp ? String(vp).trim().slice(0, 90) : null;
}

function stripTrailingGenericQuestion(reply: string, fr: boolean): string {
  const parts = String(reply ?? "")
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return reply;
  const last = parts[parts.length - 1]!;
  if (!/\?$/.test(last)) return reply;
  const re = fr ? GENERIC_HELP_FR : GENERIC_HELP_EN;
  if (re.test(norm(last))) return parts.slice(0, -1).join(" ").trim();
  return reply;
}

function goldenRuleTrim(reply: string): string {
  let t = String(reply ?? "").trim();
  if (!t) return t;
  t = t.replace(/\b(en tant qu['’']?assistant|as an ai|i am an ai|je suis une ia|chatgpt)\b/gi, "").replace(/\s{2,}/g, " ").trim();
  if (/^[-*•]\s/m.test(t)) {
    t = t
      .split(/\n/)
      .filter((line) => !/^[-*•]\s/.test(line.trim()))
      .join("\n")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return t;
}

/** Prospect reproche des erreurs / qualité à l’interlocuteur. */
export function prospectCriticizesAgentOrQuality(userMessage: string): boolean {
  const t = norm(userMessage).toLowerCase();
  if (!t) return false;
  return (
    /\b(trop\s+d['’']?erreurs|beaucoup\s+d['’']?erreurs|vous\s+vous\s+trompez|tu\s+te\s+trompes|tu\s+fais\s+(trop\s+)?d['’']?erreurs|vous\s+faites\s+(trop\s+)?d['’']?erreurs|vous\s+avez\s+tor|tu\s+as\s+tor|n['’']?importe\s+quoi|incohérent|robot|ia\b|chatgpt)/i.test(
      t,
    ) || /\b(you\s+keep\s+making\s+mistakes|you\s+are\s+wrong|too\s+many\s+mistakes)\b/i.test(t)
  );
}

function replyAcknowledgesFriction(reply: string): boolean {
  const r = norm(reply).toLowerCase();
  if (!r) return false;
  return (
    /\b(je\s+comprends|vous\s+avez\s+raison|vous\s+avez\s+totalement\s+raison|merci\s+pour|pardon|désol|désolée|excuse|je\s+vais\s+être\s+plus\s+précis|je\s+serai\s+plus\s+précis|je\s+me\s+suis\s+tromp|je\s+corrige|noté\s+pour\s+la\s+précision|fair\s+enough|you('?re)?\s+right|my\s+mistake|sorry)\b/i.test(
      r,
    )
  );
}

export type HumanAdvisorFilterResult = {
  text: string;
  wasRepaired: boolean;
  reason?: "cold_ack" | "ignored_agent_criticism" | "generic_help_shell";
};

/**
 * « Est-ce qu’un vrai conseiller humain répondrait ainsi ? » — corrections heuristiques
 * (pas de second appel LLM : garde latence et coût maîtrisés).
 */
export function filterAdvisorReplyHumanLikeness(args: {
  reply: string;
  lastUserMessage: string;
  conversationState?: SellerBehaviorConversationState;
}): HumanAdvisorFilterResult {
  let text = String(args.reply ?? "").trim();
  const user = String(args.lastUserMessage ?? "").trim();
  if (!text) return { text, wasRepaired: false };

  text = goldenRuleTrim(text);
  text = text
    .replace(/\bje\s+m['’']excuse\s+pour\s+(cette\s+)?confusion\b[\s.,!?…]*/gi, "Oui vous avez raison. ")
    .replace(/\bje\s+suis\s+désol[eé]e?\s+pour\s+(cette\s+)?confusion\b[\s.,!?…]*/gi, "Attendez je corrige ça. ")
    .replace(/\bi\s+apologize\s+for\s+(the\s+)?confusion\b[\s.,!?…]*/gi, "You’re right — ")
    .replace(/\b(lamento|disculpe)\s+(la\s+)?confusión\b[\s.,!?…]*/gi, "Tiene razón. ")
    .replace(/\bsoyez\s+rassur[eé]\b[\s.,!?…]*/gi, "On va regarder ça calmement. ")
    .replace(/\bje\s+comprends\s+votre\s+frustration\b[\s.,!?…]*/gi, "Je vois. ")
    .replace(/\bi\s+understand\s+your\s+frustration\b[\s.,!?…]*/gi, "I see. ")
    .replace(/\bmerci\s+d['’']?avoir\s+contacté[^.!?…]*[.!?…]?/gi, "")
    .replace(/\bthank\s+you\s+for\s+contacting[^.!?…]*[.!?…]?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const userLower = norm(user).toLowerCase();
  if (/\b(ne\s+me\s+pla[iî]t\s+pas|ça\s+ne\s+me\s+pla[iî]t\s+pas|franchement\s+ça\s+ne\s+me\s+pla[iî]t\s+pas)\b/i.test(userLower)) {
    let t2 = text;
    t2 = t2.replace(/\bje\s+comprends\s+votre\s+déception\b[\s.,!?…]+/gi, "Je vois. ");
    t2 = t2.replace(/\bje\s+comprends\s+votre\s+mécontentement\b[\s.,!?…]+/gi, "Je vois. ");
    if (t2 !== text) text = t2.replace(/\s{2,}/g, " ").trim();
  }

  const fr = looksFr(text) || looksFr(user);
  const focus = extractProductFocusFromState(args.conversationState);
  const vagueFollow =
    /\b(autre\s+chose|autre\s+modèle|autre\s+modele|vous\s+avez\s+autre|something\s+else|algo\s+más)\b/i.test(
      norm(user).toLowerCase(),
    );

  if (vagueFollow && focus && (GENERIC_PRODUCT_Q_FR.test(text) || GENERIC_PRODUCT_Q_EN.test(text))) {
    const esUser = /\b(hola|gracias|usted|señor|señora|precio|disponible|modelo|algo)\b/i.test(user);
    const line = esUser
      ? `¿Seguimos con ${focus}, o quiere ver otra cosa?`
      : fr
        ? `Oui — toujours sur ${focus}, ou vous voulez voir autre chose ?`
        : `Still thinking ${focus}, or want to see something else?`;
    return { text: line, wasRepaired: true, reason: "generic_help_shell" };
  }

  text = stripTrailingGenericQuestion(text, fr);

  if (COLD_ACK_WHOLE_LINE.test(norm(text))) {
    const repair = isStrongNegativeEmotionalTurn(user)
      ? fr
        ? "D’accord."
        : "Alright."
      : fr
        ? "Je vous écoute."
        : "Tell me what you need — I’m listening.";
    return { text: repair, wasRepaired: true, reason: "cold_ack" };
  }

  if (prospectCriticizesAgentOrQuality(user) && !replyAcknowledgesFriction(text)) {
    if (GENERIC_HELP_FR.test(norm(text)) || GENERIC_HELP_EN.test(norm(text))) {
      const prefix = fr ? "Vous avez raison. " : "You’re right. ";
      const stripped = norm(text).replace(GENERIC_HELP_FR, "").replace(GENERIC_HELP_EN, "").replace(/^[.?\s]+/, "");
      text = prefix + (stripped || (fr ? "Je vais être plus précis." : "I’ll be more precise."));
      return { text, wasRepaired: true, reason: "ignored_agent_criticism" };
    }
    if (!replyAcknowledgesFriction(text)) {
      const prefix = fr ? "Vous avez raison. " : "You’re right. ";
      return { text: prefix + text, wasRepaired: true, reason: "ignored_agent_criticism" };
    }
  }

  if ((GENERIC_HELP_FR.test(norm(text)) || GENERIC_HELP_EN.test(norm(text))) && user.length >= 12) {
    const substantive = /\b(prix|stock|livraison|dispo|modèle|command|pay|fcfa|€|eur|article|phone|téléphone)\b/i.test(
      user.toLowerCase(),
    );
    if (substantive && text.length < 80) {
      const prefix = fr ? "Pour votre demande : " : "On your question: ";
      return { text: prefix + text, wasRepaired: true, reason: "generic_help_shell" };
    }
  }

  return { text, wasRepaired: false };
}
