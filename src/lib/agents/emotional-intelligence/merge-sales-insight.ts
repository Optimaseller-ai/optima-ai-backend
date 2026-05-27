import type { SalesInsightSnapshot } from "@/lib/agent-control-panel/snapshot-types";
import type { EmotionalIntelligenceOutput } from "./types";
import { formatEmotionalSupervisorSummary } from "./supervisor-insights";

/** Enrichit le snapshot vente avec les insights émotionnels superviseur. */
export function enrichSalesInsightWithEmotional(
  base: SalesInsightSnapshot,
  emotional?: EmotionalIntelligenceOutput | null,
): SalesInsightSnapshot {
  if (!emotional) return base;
  const s = formatEmotionalSupervisorSummary(emotional);
  return {
    ...base,
    dominantEmotion: s.dominantEmotion,
    trustLevel: s.trustLabel,
    abandonmentRisk: s.abandonmentRisk,
    relationalQuality: s.relationalQuality,
    emotionalState: s.emotionalState,
  };
}
