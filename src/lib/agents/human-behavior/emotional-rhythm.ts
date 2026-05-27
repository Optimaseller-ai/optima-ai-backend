/**
 * Rythme émotionnel du fil — énergie / chaleur qui évoluent avec le dialogue.
 */

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { inferConversationEmotionalTemperature } from "@/lib/agents/human-behavior/emotions/conversation-emotion";

export type EmotionalRhythmPhase = "opening" | "building" | "strained" | "warm" | "cooling";

export function inferEmotionalRhythmPhase(args: {
  message: string;
  turnCount?: number;
  fatigue01?: number;
  state?: SellerBehaviorConversationState;
}): EmotionalRhythmPhase {
  const turns = args.turnCount ?? 0;
  const temp = inferConversationEmotionalTemperature(args.message);
  const fatigue = args.fatigue01 ?? 0;
  if (temp === "irrité" || temp === "frustré") return "strained";
  if (temp === "chaleureux" || temp === "prêt_achat") return "warm";
  if (fatigue >= 0.55 || turns >= 14) return "cooling";
  if (turns <= 2) return "opening";
  return "building";
}

export function formatEmotionalRhythmPromptBlock(phase: EmotionalRhythmPhase, lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    const m: Record<EmotionalRhythmPhase, string> = {
      opening: "EMOTIONAL RHYTHM: early thread — steady, welcoming, not over-eager.",
      building: "EMOTIONAL RHYTHM: mid thread — let warmth/energy drift slightly with their tone.",
      strained: "EMOTIONAL RHYTHM: friction — calmer, shorter, stable; don’t escalate.",
      warm: "EMOTIONAL RHYTHM: warm stretch — match lightly; stay professional.",
      cooling: "EMOTIONAL RHYTHM: long thread — slightly more concise; same human care.",
    };
    return m[phase];
  }
  if (lang === "es") {
    return `RITMO EMOCIONAL (${phase}): adapte energía y calidez con sutileza.`;
  }
  const m: Record<EmotionalRhythmPhase, string> = {
    opening: "RYTHME ÉMOTIONNEL : début de fil — stable, accueillant, pas survendeur.",
    building: "RYTHME ÉMOTIONNEL : milieu de fil — laisser énergie/chaleur évoluer légèrement avec le prospect.",
    strained: "RYTHME ÉMOTIONNEL : tension — plus calme, plus court, stable.",
    warm: "RYTHME ÉMOTIONNEL : moment chaleureux — suivre un peu, rester pro.",
    cooling: "RYTHME ÉMOTIONNEL : fil long — un peu plus concis, même attention humaine.",
  };
  return m[phase];
}
