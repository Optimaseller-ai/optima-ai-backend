import "server-only";

import { resolveConversationRouting } from "@/lib/agents/social/business-conversation-router";
import { runSocialConversationEngine } from "@/lib/agents/social/social-conversation-engine";
import type { PipelineFallbackKind, PipelineLang } from "./pipeline-types";

const HOLD_BANNED =
  /^\s*(je\s+vérifie|je\s+verifie|je\s+regarde|un\s+instant|let\s+me\s+check|one\s+moment|just\s+a\s+moment)\s*[.!?]*$/i;

const COMMERCIAL_BANNED_FALLBACK =
  /\b(je\s+suis\s+\w+\s+chez|dites[- ]moi\s+ce\s+que\s+vous\s+cherchez|quel\s+produit|comment\s+puis[- ]je\s+vous\s+aider|bonjour\s+—\s+je\s+vous\s+écoute)\b/i;

export type ContextualFallbackInput = {
  lang: PipelineLang;
  userMessage: string;
  agentName: string;
  businessName: string;
  personaKey?: string | null;
  kind: PipelineFallbackKind;
  /** Frustration 0–1 si connue */
  frustrationLevel01?: number;
  welcomeAlreadyDelivered?: boolean;
  allowEmoji?: boolean;
  /** Topics business knowledge (ex. product, pricing) — oriente le fallback vente. */
  topics?: string[];
};

const PRODUCT_TOPIC_RE = /\b(product|catalog|catalogue|pricing|stock|sku|article)\b/i;

const PRODUCT_MESSAGE_RE =
  /\b(prix|stock|dispo|commander|acheter|modèle|modele|article|téléphone|telephone|écouteur|ecouteur|phone|iphone|samsung|accessoire|livraison|devis)\b/i;

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length]!;
}

/** Jamais « Je vérifie » / « Un instant » comme fallback global. */
export function isBannedHoldFallback(text: string): boolean {
  return HOLD_BANNED.test(String(text ?? "").trim());
}

function routingForFallback(input: ContextualFallbackInput) {
  return resolveConversationRouting({
    message: input.userMessage,
    topics: input.topics,
  });
}

export function wantsProductOrientedFallback(input: ContextualFallbackInput): boolean {
  if (routingForFallback(input).disableSocialFallback) return true;
  const topics = input.topics ?? [];
  if (topics.some((t) => PRODUCT_TOPIC_RE.test(String(t)))) return true;
  return PRODUCT_MESSAGE_RE.test(String(input.userMessage ?? ""));
}

/** Fallback vente — jamais « ça va bien merci » sur demande produit. */
export function getProductOrientedFallback(input: ContextualFallbackInput): string {
  const smile = input.allowEmoji ? " 🙂" : "";
  const seed = input.userMessage + (input.topics?.join(",") ?? "");
  const biz = input.businessName.trim() || "notre boutique";

  if (input.lang === "en") {
    return pick(
      [
        `I can suggest our most popular models${smile} — headphones, phones, or accessories?`,
        `Happy to help at ${biz}${smile} — what model or category are you looking for?`,
      ],
      seed,
    );
  }
  if (input.lang === "es") {
    return pick(
      [
        `Le puedo proponer nuestros modelos más pedidos${smile} — ¿auriculares, teléfono o accesorios?`,
        `Con gusto en ${biz}${smile} — ¿qué modelo busca?`,
      ],
      seed,
    );
  }
  return pick(
    [
      `Je peux vous proposer nos modèles les plus demandés${smile} — vous cherchez plutôt écouteurs, téléphone ou accessoires ?`,
      `Avec plaisir chez ${biz}${smile} — quel modèle ou type d'article vous intéresse ?`,
      `Je vous guide sur le catalogue${smile} — dites-moi ce qui vous ferait envie.`,
    ],
    seed,
  );
}

function defaultSafeFallback(input: ContextualFallbackInput): string {
  if (wantsProductOrientedFallback(input)) {
    return getProductOrientedFallback(input);
  }
  const smile = input.allowEmoji ? " 🙂" : "";
  return input.lang === "en"
    ? `Sorry — I can help you pick an item${smile}.`
    : input.lang === "es"
      ? `Perdone — le ayudo a elegir un artículo${smile}.`
      : `Désolé, je peux vous aider à choisir un article${smile}.`;
}

/** Appel sécurisé — import manquant ou erreur runtime. */
export function safeGetContextualFallback(input: ContextualFallbackInput): string {
  try {
    if (typeof getContextualFallback === "function") {
      return getContextualFallback(input);
    }
  } catch (e) {
    console.error("[OPTIMA_FALLBACK_ERROR]", e);
  }
  return defaultSafeFallback(input);
}

function socialFallback(input: ContextualFallbackInput): string {
  if (routingForFallback(input).disableSocialFallback || wantsProductOrientedFallback(input)) {
    return getProductOrientedFallback(input);
  }
  const social = runSocialConversationEngine({
    message: input.userMessage,
    agentName: input.agentName,
    businessName: input.businessName,
    personaKey: input.personaKey,
    welcomeAlreadyDelivered: input.welcomeAlreadyDelivered,
    allowEmoji: input.allowEmoji ?? true,
    lang: input.lang,
  });
  const reply = social.reply?.trim();
  if (reply && !COMMERCIAL_BANNED_FALLBACK.test(reply) && !isBannedHoldFallback(reply)) {
    return reply;
  }
  const smile = input.allowEmoji ? " 🙂" : "";
  return input.lang === "en"
    ? `Doing well${smile} — and you?`
    : input.lang === "es"
      ? `Bien, gracias${smile} — ¿y usted?`
      : `Ça va bien merci${smile} — et vous ?`;
}

/**
 * Fallbacks contextuels — social humain uniquement, jamais script vente agressif.
 */
export function getContextualFallback(input: ContextualFallbackInput): string {
  const lang = input.lang;
  const msg = String(input.userMessage ?? "").trim();
  const agent = input.agentName.trim() || (lang === "en" ? "Advisor" : lang === "es" ? "Asesor" : "Conseiller");
  const seed = msg + agent;

  if (input.kind === "takeover") {
    return lang === "en"
      ? "A team member will reply shortly."
      : lang === "es"
        ? "Un miembro del equipo le responderá enseguida."
        : "Un conseiller vous répond sous peu.";
  }

  if (wantsProductOrientedFallback(input)) {
    return getProductOrientedFallback(input);
  }

  if (input.kind === "social" || input.kind === "empathetic") {
    return socialFallback(input);
  }

  if (input.kind === "neutral") {
    return socialFallback(input);
  }

  const frustrated = (input.frustrationLevel01 ?? 0) > 0.45;
  if (frustrated) {
    const empathetic =
      lang === "en"
        ? [
            `I hear you — we'll sort this out together.`,
            `Thanks for your patience.`,
            `I understand — tell me what went wrong.`,
          ]
        : lang === "es"
          ? [
              `Le entiendo — lo resolvemos juntos.`,
              `Gracias por su paciencia.`,
              `Comprendo — cuénteme qué pasó.`,
            ]
          : [
              `Je vous entends — on règle ça ensemble.`,
              `Merci pour votre patience.`,
              `Je comprends — dites-moi ce qui bloque.`,
            ];
    return pick(empathetic, seed);
  }

  if (input.kind === "discovery") {
    return getProductOrientedFallback(input);
  }

  if (input.kind === "generate_failed") {
    if (wantsProductOrientedFallback(input)) {
      return getProductOrientedFallback(input);
    }
    return defaultSafeFallback(input);
  }

  return socialFallback(input);
}

/** Remplace tout fallback serveur historique interdit. */
export function ensureHumanFallbackReply(text: string, input: ContextualFallbackInput): string {
  const trimmed = String(text ?? "").trim();
  if (
    !trimmed ||
    isBannedHoldFallback(trimmed) ||
    COMMERCIAL_BANNED_FALLBACK.test(trimmed) ||
    /\b(je\s+vérifie|let\s+me\s+check)\b/i.test(trimmed)
  ) {
    return getContextualFallback(input);
  }
  return trimmed;
}
