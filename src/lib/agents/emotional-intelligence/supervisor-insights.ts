import type { EmotionalIntelligenceOutput } from "./types";

/** Lignes compactes pour dashboard / API supervision. */
export function formatEmotionalSupervisorSummary(output: EmotionalIntelligenceOutput): {
  dominantEmotion: string;
  trustLabel: string;
  abandonmentRisk: string;
  relationalQuality: string;
  emotionalState: string;
} {
  const s = output.supervisor;
  return {
    dominantEmotion: s.dominantEmotion,
    trustLabel: `${s.trustBand} (${Math.round(s.trustLevel01 * 100)}%)`,
    abandonmentRisk: s.abandonmentRisk,
    relationalQuality: s.relationalQuality,
    emotionalState: s.conversationEmotionalState,
  };
}
