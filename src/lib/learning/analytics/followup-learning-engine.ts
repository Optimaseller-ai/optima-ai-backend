import type { FollowupPerformance, LearningMemory } from "../memory/learning-memory-types";

export type FollowupObservation = {
  delayHours: number;
  at: string;
  /** Prospect a répondu après relance */
  replied?: boolean;
  converted?: boolean;
};

function labelDelay(h: number): string {
  if (h < 1) return "Moins d’1h";
  if (h < 3) return "1–3h";
  if (h < 12) return "3–12h";
  if (h < 48) return "12–48h";
  return "Plus de 48h";
}

export function applyFollowupObservations(
  memory: LearningMemory,
  observations: FollowupObservation[],
): LearningMemory {
  const buckets = new Map<number, FollowupPerformance>();
  for (const f of memory.successfulFollowups) {
    buckets.set(f.delayHours, { ...f });
  }

  for (const o of observations) {
    const h = Math.round(Math.max(0.5, o.delayHours) * 2) / 2;
    const cur = buckets.get(h) ?? {
      delayHours: h,
      label: labelDelay(h),
      successRate: 0,
      samples: 0,
    };
    const success = o.replied || o.converted ? 1 : 0;
    const samples = cur.samples + 1;
    const successRate = (cur.successRate * cur.samples + success * 100) / samples;
    buckets.set(h, {
      delayHours: h,
      label: labelDelay(h),
      successRate: Math.round(successRate),
      samples,
    });
  }

  const successfulFollowups = [...buckets.values()]
    .filter((b) => b.samples >= 1)
    .sort((a, b) => b.successRate - a.successRate || b.samples - a.samples)
    .slice(0, 8);

  return { ...memory, successfulFollowups, updatedAt: new Date().toISOString() };
}
