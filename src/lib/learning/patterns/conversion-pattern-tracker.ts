import type { LearningMemory, ScoredPhrase } from "../memory/learning-memory-types";

export type ConversionObservation = {
  assistantPhrase: string;
  converted: boolean;
  at: string;
  closingLike?: boolean;
};

const CLOSING_HINTS =
  /\b(réserver|reserve|commander|order|valider|confirm|passer commande|je vous le garde|je peux vous le|on finalise|on conclut)\b/i;

export function isClosingPhrase(text: string): boolean {
  return CLOSING_HINTS.test(String(text ?? ""));
}

function normPhrase(s: string): string {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function bumpPhrase(list: ScoredPhrase[], phrase: string, converted: boolean, at: string): ScoredPhrase[] {
  const p = normPhrase(phrase);
  if (p.length < 12) return list;

  const idx = list.findIndex((x) => x.phrase === p);
  const delta = converted ? 1 : 0;
  if (idx >= 0) {
    const cur = list[idx]!;
    const samples = cur.samples + 1;
    const score = (cur.score * cur.samples + delta * 100) / samples;
    const next = [...list];
    next[idx] = {
      phrase: p,
      score: Math.round(score),
      samples,
      lastSeen: at,
      reason: converted ? "Associée à une conversion" : "Testée sans conversion",
    };
    return next.sort((a, b) => b.score - a.score).slice(0, 24);
  }

  return [
    { phrase: p, score: converted ? 100 : 20, samples: 1, lastSeen: at },
    ...list,
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
}

export function applyConversionObservations(
  memory: LearningMemory,
  observations: ConversionObservation[],
): LearningMemory {
  let closings = [...memory.topPerformingClosings];
  let responses = [...memory.effectiveResponses];
  let conversions = memory.conversions;

  for (const o of observations) {
    if (o.converted) conversions += 1;
    responses = bumpPhrase(responses, o.assistantPhrase, o.converted, o.at);
    if (o.closingLike || isClosingPhrase(o.assistantPhrase)) {
      closings = bumpPhrase(closings, o.assistantPhrase, o.converted, o.at);
    }
  }

  return {
    ...memory,
    conversions,
    topPerformingClosings: closings,
    effectiveResponses: responses,
    updatedAt: new Date().toISOString(),
  };
}
