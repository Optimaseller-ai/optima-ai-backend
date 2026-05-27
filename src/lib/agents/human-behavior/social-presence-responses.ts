/**
 * Bibliothèque de réponses sociales naturelles — « tu fais quoi ? », présence au travail.
 */

import type { ProspectProfile } from "@/lib/agents/memory/prospect-profile";
import { frenchHonorificSmart } from "@/lib/agents/memory/prospect-profile";
import { norm, type SellerLanguage } from "@/lib/agents/seller-language";
import { detectSocialIntent } from "./social-intent-engine";

function pickOne<T>(items: T[], seed: string): T {
  let h = 0;
  const s = seed || "x";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return items[h % items.length]!;
}

const WHAT_DOING_FR = [
  "Je suis encore au bureau.",
  "Je vérifie quelques commandes.",
  "Je travaille encore un peu.",
  "Je suis avec quelques clients actuellement.",
  "Je regarde le stock actuellement.",
  "Je termine quelques vérifications.",
  "La journée est un peu longue aujourd’hui.",
  "Je suis encore au magasin.",
];

const WHAT_DOING_EN = [
  "Still at the shop.",
  "Checking a few orders.",
  "Still working a bit.",
  "With a couple of customers right now.",
  "Looking at stock.",
  "Wrapping up a few checks.",
  "Long day today.",
  "Still at the office.",
];

const WHAT_DOING_ES = [
  "Sigo en la tienda.",
  "Reviso unos pedidos.",
  "Trabajo un poco más.",
  "Con unos clientes ahora.",
  "Miro el stock.",
  "Termino unas verificaciones.",
  "Día largo hoy.",
];

const HEY_AGENT_FR = ["Oui ?", "Oui je vous écoute.", "Oui — je suis là."];
const HEY_AGENT_EN = ["Yes?", "I’m here.", "Yeah — go ahead."];
const HEY_AGENT_ES = ["¿Sí?", "Dígame.", "Aquí estoy."];

export function trySocialPresenceQuickReply(args: {
  message: string;
  lang: SellerLanguage;
  agentName: string;
  prospectProfile?: ProspectProfile;
  turnCount?: number;
  welcomeDelivered?: boolean;
}): string | null {
  const raw = norm(args.message);
  const intent = detectSocialIntent(raw, {
    agentName: args.agentName,
    turnCount: args.turnCount,
    welcomeAlreadyDelivered: args.welcomeDelivered,
  });

  const seed = raw + args.agentName;

  if (intent.kind === "personal_question" || /\b(tu\s+fais\s+quoi|what\s+are\s+you\s+doing|qué\s+haces)\b/i.test(raw)) {
    if (args.lang === "en") return pickOne(WHAT_DOING_EN, seed);
    if (args.lang === "es") return pickOne(WHAT_DOING_ES, seed);
    return pickOne(WHAT_DOING_FR, seed);
  }

  if (intent.kind === "social_chat" && /\b(hey|salut|coucou)\b/i.test(raw) && raw.length < 40) {
    const honor = frenchHonorificSmart(args.prospectProfile);
    if (args.lang === "en") return pickOne(HEY_AGENT_EN, seed);
    if (args.lang === "es") return pickOne(HEY_AGENT_ES, seed);
    return pickOne(honor ? [`Oui ${honor} ?`, ...HEY_AGENT_FR] : HEY_AGENT_FR, seed);
  }

  return null;
}

export function formatHumanSocialPresencePromptBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "HUMAN SOCIAL PRESENCE:",
      "- Sound like a real workday: “Still at the shop.” “Checking orders.” “Long day.” — never welcome-to-company script.",
    ].join("\n");
  }
  if (lang === "es") {
    return "PRESENCIA SOCIAL: jornada real en tienda — sin guion de bienvenida.";
  }
  return [
    "PRÉSENCE SOCIALE HUMAINE :",
    "- Vivre une vraie journée : « Je suis encore au magasin. » « Je vérifie des commandes. » — jamais script bienvenue support.",
  ].join("\n");
}

export function formatSocialFlowRealismPromptBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return "SOCIAL FLOW: reply like real WhatsApp — not automatic customer support.";
  }
  if (lang === "es") {
    return "FLUJO SOCIAL: WhatsApp real — no soporte automático.";
  }
  return "FLUX SOCIAL : répondre comme WhatsApp réel — PAS comme support automatique.";
}

export function formatPreventSupportModePromptBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "PREVENT SUPPORT MODE:",
      "- Do NOT default to: welcome message, “how can I help”, service desk tone.",
      "- If they talk to you as a person, answer as that person.",
    ].join("\n");
  }
  if (lang === "es") {
    return "EVITAR MODO SOPORTE: sin bienvenida corporativa ni «en qué puedo ayudarle».";
  }
  return [
    "ANTI-MODE SUPPORT :",
    "- Ne pas retomber en accueil / « comment puis-je vous aider » / ton standard téléphonique.",
    "- S’ils parlent à vous comme à une personne, répondre en tant que personne.",
  ].join("\n");
}
