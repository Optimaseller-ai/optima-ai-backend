import type { ProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";

import type { LearningMemory, ScoredPhrase } from "../memory/learning-memory-types";

export type ResponseOutcome = "success" | "abandon" | "ongoing" | "unknown";

export type ResponsePerformanceRecord = {
  assistantReply: string;
  prospectEmotion?: ProspectEmotion | string;
  outcome: ResponseOutcome;
  at: string;
  msToNextUserReply?: number;
};

function outcomeScore(outcome: ResponseOutcome): number {
  if (outcome === "success") return 100;
  if (outcome === "ongoing") return 55;
  if (outcome === "abandon") return 15;
  return 40;
}

export function recordResponsePerformance(
  memory: LearningMemory,
  record: ResponsePerformanceRecord,
): LearningMemory {
  const phrase = String(record.assistantReply ?? "").trim().slice(0, 120);
  if (phrase.length < 10) return memory;

  const base = outcomeScore(record.outcome);
  const emotionBonus =
    record.prospectEmotion === "curiosity" ||
    record.prospectEmotion === "purchase_interest" ||
    record.prospectEmotion === "enthusiasm"
      ? 8
      : 0;
  const score = Math.min(100, base + emotionBonus);

  const idx = memory.effectiveResponses.findIndex((x) => x.phrase === phrase);
  let effectiveResponses: ScoredPhrase[];

  if (idx >= 0) {
    const cur = memory.effectiveResponses[idx]!;
    const samples = cur.samples + 1;
    const avg = (cur.score * cur.samples + score) / samples;
    effectiveResponses = [...memory.effectiveResponses];
    effectiveResponses[idx] = {
      phrase,
      score: Math.round(avg),
      samples,
      lastSeen: record.at,
      reason: `Émotion prospect: ${record.prospectEmotion ?? "—"} · ${record.outcome}`,
    };
  } else {
    effectiveResponses = [
      {
        phrase,
        score,
        samples: 1,
        lastSeen: record.at,
        reason: `Résultat: ${record.outcome}`,
      },
      ...memory.effectiveResponses,
    ];
  }

  effectiveResponses.sort((a, b) => b.score - a.score);

  return {
    ...memory,
    effectiveResponses: effectiveResponses.slice(0, 30),
    totalObservations: memory.totalObservations + 1,
    updatedAt: new Date().toISOString(),
  };
}
