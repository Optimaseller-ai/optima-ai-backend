import "server-only";

import { detectProspectEmotion } from "../emotions/emotion-detector";
import { inferConversationEmotionalTemperature } from "../emotions/conversation-emotion";
import { computeResponseWeight } from "../response-weight-system";
import { detectResponsePrimaryIntent } from "../coherence/response-intent";
import {
  detectConversationalOverloadRisk,
  detectMicroReplyIntent,
} from "../human-short-reply-engine";

/**
 * Ce que le tour conversationnel appelle comme comportement humain optimal.
 */
export type ConversationResponseMode =
  | "micro" /** 1–6 mots si suffisant */
  | "short" /** 1–2 phrases */
  | "normal"
  | "rich" /** détail seulement si le prospect ouvre */
  | "hold_pause" /** « je regarde » / silence utile */
  | "defer_soft"; /** laisser respirer, pas empiler */

export type ConversationPrioritySnapshot = {
  mode: ConversationResponseMode;
  rationale: string;
};

function isTeasingOrSocialEdge(message: string): boolean {
  return /\b(dormez\s+jamais|tu\s+dors|vous\s+dormez|you\s+never\s+sleep|no\s+duerme)\b/i.test(message);
}

export function inferConversationPrioritySnapshot(args: {
  lastUserMessage: string;
  fatigue01?: number;
}): ConversationPrioritySnapshot {
  const msg = String(args.lastUserMessage ?? "").trim();
  const m = msg.toLowerCase();
  const intent = detectResponsePrimaryIntent(msg);
  const emotion = detectProspectEmotion(msg);
  const weight = computeResponseWeight(msg);
  const temp = inferConversationEmotionalTemperature(msg);
  const fatigue = Math.max(0, Math.min(1, args.fatigue01 ?? 0));

  if (isTeasingOrSocialEdge(msg)) {
    return { mode: "short", rationale: "taquinage / social léger — réponse courte, humaine" };
  }

  if (intent === "location" || intent === "thanks") {
    return { mode: "micro", rationale: "question ponctuelle / merci — réponse minimale crédible" };
  }

  if (detectMicroReplyIntent(msg) !== "none" || detectConversationalOverloadRisk(msg)) {
    return {
      mode: msg.length < 22 ? "micro" : "short",
      rationale: "tour court / intention claire — pas de relance commerciale",
    };
  }

  if (msg.length < 25) {
    return { mode: "micro", rationale: "HUMAN_SHORT_REPLY_MODE — message court" };
  }

  if (emotion === "anger" || emotion === "frustration" || temp === "frustré" || temp === "irrité") {
    return { mode: "short", rationale: "émotion négative — court, calme, pas de pavé" };
  }

  if (/\b(attendez|une\s+seconde|patientez|wait)\b/i.test(m) && msg.length < 80) {
    return { mode: "short", rationale: "demande de patience — réponse courte" };
  }

  if (weight.tier === "heavy" || msg.length > 240) {
    return { mode: "rich", rationale: "message dense — peut détailler un peu sans essai" };
  }

  if (fatigue > 0.55) {
    return { mode: "defer_soft", rationale: "fatigue conversationnelle — moins de mots, plus de naturel" };
  }

  if (intent === "wellbeing" || intent === "greeting") {
    return { mode: "short", rationale: "social / salut — bref" };
  }

  return { mode: "normal", rationale: "tour standard" };
}

export function formatConversationPriorityPromptBlock(
  snapshot: ConversationPrioritySnapshot,
  lang: "fr" | "en" | "es",
): string {
  if (lang === "en") {
    return [
      "LEVEL 14 — HUMAN CONVERSATION PRIORITY:",
      `- This turn calls for: **${snapshot.mode}** (${snapshot.rationale}).`,
      "- micro/short: do NOT pad with corporate empathy or extra questions.",
      "- rich: stay human — no numbered manifesto.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "NIVEL 14 — PRIORIDAD CONVERSACIONAL:",
      `- Este turno pide: **${snapshot.mode}** (${snapshot.rationale}).`,
      "- micro/corto: sin relleno ni interrogatorio al final.",
    ].join("\n");
  }
  return [
    "NIVEAU 14 — PRIORITÉ CONVERSATIONNELLE HUMAINE :",
    `- Ce tour demande : **${snapshot.mode}** (${snapshot.rationale}).`,
    "- micro/court : pas de pavé, pas de « petite parenthèse » inutile.",
    "- rich : détail OK si utile — jamais dissertation.",
  ].join("\n");
}
