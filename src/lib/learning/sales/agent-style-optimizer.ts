import type { LearningMemory, StylePerformance } from "../memory/learning-memory-types";

export type StyleObservation = {
  tone: string;
  at: string;
  converted?: boolean;
  positiveReply?: boolean;
};

const TONE_ALIASES: Record<string, string> = {
  conseiller: "soft",
  closer: "direct",
  premium: "premium",
  chaleureux: "warm",
  professionnel: "pro",
  dynamique: "dynamic",
  soft: "soft",
  balanced: "balanced",
  aggressive: "direct",
};

export function normalizeSalesTone(raw?: string | null): string {
  const k = String(raw ?? "balanced").toLowerCase().trim();
  return (TONE_ALIASES[k] ?? k.slice(0, 24)) || "balanced";
}

export function applyStyleObservations(
  memory: LearningMemory,
  observations: StyleObservation[],
): LearningMemory {
  const map = new Map<string, StylePerformance>();
  for (const s of memory.stylePerformance) {
    map.set(s.tone, { ...s });
  }

  for (const o of observations) {
    const tone = normalizeSalesTone(o.tone);
    const cur = map.get(tone) ?? { tone, score: 50, samples: 0 };
    const delta = o.converted ? 100 : o.positiveReply ? 70 : 35;
    const samples = cur.samples + 1;
    const score = (cur.score * cur.samples + delta) / samples;
    map.set(tone, { tone, score: Math.round(score), samples });
  }

  const stylePerformance = [...map.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return { ...memory, stylePerformance, updatedAt: new Date().toISOString() };
}
