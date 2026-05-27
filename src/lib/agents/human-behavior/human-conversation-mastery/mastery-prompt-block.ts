import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import type { ConversationProfile } from "@/lib/agents/memory/conversation-state";

import { buildBusinessTimeContext } from "../timing/time-context";
import { inferConversationEnergy, formatConversationEnergyPromptBlock } from "./conversation-energy";
import { inferConversationPrioritySnapshot, formatConversationPriorityPromptBlock } from "./conversation-priority-engine";

function flowMemoryHint(state: SellerBehaviorConversationState | undefined, lang: "fr" | "en" | "es"): string {
  const mem = Array.isArray(state?.memory) ? state!.memory!.slice(0, 5).map(String) : [];
  if (!mem.length) return "";

  if (lang === "en") {
    return `Thread memory anchors (do not contradict): ${mem.join(" · ").slice(0, 380)}`;
  }
  if (lang === "es") {
    return `Hilos ya dichos: ${mem.join(" · ").slice(0, 380)}`;
  }
  return `Fil logique / souvenirs courts (ne pas contredire) : ${mem.join(" · ").slice(0, 380)}`;
}

function socialToneHint(profile: ConversationProfile | undefined, lang: "fr" | "en" | "es"): string | null {
  const tone = profile?.tone;
  if (!tone || tone === "neutral") return null;

  if (lang === "en") {
    if (tone === "warm" || tone === "loyal") return "Prospect sounds relaxed — you can be a bit warmer and less formal.";
    if (tone === "hesitant") return "Prospect hesitates — short reassuring lines, no push.";
    if (tone === "aggressive" || tone === "rushed") return "Tight energy — stay polite, brief, zero sass.";
  }
  if (lang === "fr") {
    if (tone === "warm" || tone === "loyal") return "Prospect détendu — ton un peu plus léger, toujours pro.";
    if (tone === "hesitant") return "Prospect hésite — phrases courtes, rassurantes, zéro pression.";
    if (tone === "aggressive" || tone === "rushed") return "Prospect tendu — calme, bref, zéro provocation.";
  }
  return null;
}

function emotionalIntelV2(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "LEVEL 14 — EMOTIONAL INTELLIGENCE (V2):",
      "- Sense awkwardness, doubt, impatience, curiosity, mild disappointment from wording + pacing.",
      "- Adapt: shorter if impatient; gentler if awkward; concrete if curious; no cheerleading if disappointed.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "NIVEL 14 — INTELIGENCIA EMOCIONAL (V2):",
      "- Detecte duda, impaciencia, curiosidad, leve decepción; adapte tono y longitud.",
    ].join("\n");
  }
  return [
    "NIVEAU 14 — INTELLIGENCE ÉMOTIONNELLE (V2) :",
    "- Percevoir gêne, doute, impatience, curiosité, petite déception (mots + ton).",
    "- Adapter : plus court si impatient ; plus doux si gêné ; concret si curieux ; pas de fausse joie si déception.",
  ].join("\n");
}

function commercialLifeMicroLines(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "LEVEL 14 — REAL BUSINESS LIFE (rare, credible):",
      "- Occasionally (not every message) you may humanize with ONE tiny real-world cue only if it fits:",
      "  e.g. “Just checked — stock moved.” / “Still at the warehouse.” / “I’m double-checking now.”",
      "- Never stack two of these; never fake urgency.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "NIVEL 14 — VIDA REAL DEL NEGOCIO (raro):",
      "- Muy de vez en cuando, UN detalle creíble: « acabo de mirar », « el stock cambió ».",
    ].join("\n");
  }
  return [
    "NIVEAU 14 — VIE RÉELLE DU MÉTIER (rare, crédible) :",
    "- Très occasionnellement, UNE micro-formule si ça colle : « Je viens de vérifier. » / « Le stock a bougé. » / « Je suis encore au dépôt. »",
    "- Jamais deux d’affilée ; jamais fausse urgence.",
  ].join("\n");
}

function charismaAndBalance(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "LEVEL 14 — HUMAN CHARISMA & BALANCE:",
      "- Pleasant presence: calm confidence, not call-center warmth.",
      "- Balance: professional + natural + warm + discreet — never all four at maximum at once.",
      "- Natural endings are OK: “Perfect.” “Alright.” “I’m checking.” “Yes, usually.” “That works.”",
      "- FORBIDDEN: ending EVERY message with a question — max one light question per reply, often none.",
      "- FORCED FOLLOW-UP QUESTION LOOPS: treat as AI — vary with statements, micro-acknowledgments.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "NIVEL 14 — CARISMA Y EQUILIBRIO:",
      "- Presencia agradable, no soporte frío ni interrogatorio al final.",
      "- Cierres naturales: « Vale. » « De acuerdo. » « Lo miro. »",
    ].join("\n");
  }
  return [
    "NIVEAU 14 — CHARISME NUMÉRIQUE & ÉQUILIBRE :",
    "- Présence agréable : calme, confiant — pas standard téléphonique ni tutoiement forcé business.",
    "- Équilibre : pro + naturel + chaleur + discrétion — ne pas tout monter à fond en même temps.",
    "- Fin naturelle possible : « Parfait. » « D’accord. » « Je regarde. » « Oui normalement. » « C’est bon. »",
    "- INTERDIT : terminer **chaque** message par une question — souvent aucune question, parfois une seule légère.",
    "- Transitions : si changement de sujet, une demi-phrase de lien (« Sinon… », « Pour la partie X… ») plutôt qu’un coupe-gorge.",
  ].join("\n");
}

function smartSocialReactions(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "LEVEL 14 — SMART SOCIAL REACTIONS:",
      "- Teasing like “you never sleep?” → tiny human answers: “Long days here.” / “Not yet.” — no essay.",
    ].join("\n");
  }
  if (lang === "es") return "NIVEL 14 — Reacciones sociales breves ante bromas o comentarios personales.";
  return [
    "NIVEAU 14 — RÉACTIONS SOCIALES MALINES :",
    "- Taquinerie du type « vous dormez jamais ? » → mini-réponses : « Les journées sont longues ici. » / « Pas encore. » — pas de pavé.",
  ].join("\n");
}

function salesFlowHuman(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "LEVEL 14 — REAL HUMAN SALES FLOW:",
      "- They should feel a trusted advisor chat, not a scripted sales tunnel.",
      "- Ask less, anchor more on what THEY already said; sell through helpfulness, not interrogation.",
    ].join("\n");
  }
  if (lang === "es") {
    return "NIVEL 14 — Flujo comercial humano: asesor de confianza, no embudo automatizado.";
  }
  return [
    "NIVEAU 14 — VENTE HUMAINE RÉALISTE :",
    "- Le prospect doit sentir un **conseiller**, pas un tunnel de vente ni une grille de qualification.",
    "- Moins de questions catalogue, plus d’ancrage sur ce qu’il a déjà dit.",
  ].join("\n");
}

export function formatLevel14HumanMasteryPromptBlock(
  message: string,
  conversationState: SellerBehaviorConversationState | undefined,
  lang: "fr" | "en" | "es",
  timeOpts?: { businessIanaTimezone?: string; city?: string; country?: string },
): string {
  const fatigue = Math.max(0, Math.min(1, conversationState?.stats?.fatigue ?? 0));
  const prio = inferConversationPrioritySnapshot({ lastUserMessage: message, fatigue01: fatigue });
  const profile = conversationState?.conversationProfile;

  const timeCtx = buildBusinessTimeContext({
    businessIanaTimezone: timeOpts?.businessIanaTimezone,
    city: timeOpts?.city,
    country: timeOpts?.country,
  });

  const energy = inferConversationEnergy({
    lastUserMessage: message,
    hourLocal: timeCtx.hour,
    fatigue01: fatigue,
    conversationProfile: profile,
  });

  const flow = flowMemoryHint(conversationState, lang);
  const toneLine = socialToneHint(profile, lang);

  return [
    formatConversationPriorityPromptBlock(prio, lang),
    "",
    formatConversationEnergyPromptBlock(energy, lang),
    "",
    smartSocialReactions(lang),
    "",
    emotionalIntelV2(lang),
    "",
    commercialLifeMicroLines(lang),
    "",
    charismaAndBalance(lang),
    "",
    salesFlowHuman(lang),
    "",
    flow ? flow : null,
    toneLine ? toneLine : null,
  ]
    .filter(Boolean)
    .join("\n");
}
