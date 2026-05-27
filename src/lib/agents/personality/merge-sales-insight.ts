import type { SalesInsightSnapshot } from "@/lib/agent-control-panel/snapshot-types";
import type { PersonalityConsistencyOutput } from "./personality-consistency-engine";

export function enrichSalesInsightWithPersonality(
  base: SalesInsightSnapshot,
  personality?: PersonalityConsistencyOutput | null,
): SalesInsightSnapshot {
  if (!personality) return base;
  const s = personality.supervisor;
  return {
    ...base,
    activePersonality: s.activePersonality,
    personalityConsistency: `${Math.round(s.consistencyScore * 100)}%`,
    humanizationQuality: s.humanizationQuality,
    emotionalStability: s.emotionalStability,
  };
}
