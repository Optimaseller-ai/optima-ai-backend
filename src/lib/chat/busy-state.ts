/**
 * État « occupé » occasionnel — l’agent semble gérer d’autres clients / vérifs.
 */

export type BusyStateLevel = "normal" | "busy";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export function inferBusyState(seed: string, turnCount = 0): BusyStateLevel {
  const h = seedHash(seed + "busy");
  const chance = turnCount > 4 ? 14 : 10;
  return h % 100 < chance ? "busy" : "normal";
}

export function busyStateMultipliers(level: BusyStateLevel): {
  read: number;
  pauseAfterSeen: number;
  reflection: number;
  typing: number;
} {
  if (level === "busy") {
    return { read: 1.38, pauseAfterSeen: 1.32, reflection: 1.28, typing: 1.22 };
  }
  return { read: 1, pauseAfterSeen: 1, reflection: 1, typing: 1 };
}
