export type SilenceRead = {
  /** 0 = actif, 1 = silence prolongé */
  silenceScore01: number;
  suggestFollowupWait: boolean;
  hoursSinceLastActivity?: number;
};

/** Interprète le temps de silence prospect (sans transcript complet). */
export function analyzeProspectSilence(args: {
  silenceMs?: number;
  lastActiveAt?: number;
  now?: number;
}): SilenceRead {
  const now = args.now ?? Date.now();
  let ms = typeof args.silenceMs === "number" ? Math.max(0, args.silenceMs) : 0;

  if (!ms && typeof args.lastActiveAt === "number" && args.lastActiveAt > 0) {
    ms = Math.max(0, now - args.lastActiveAt);
  }

  const hours = ms / (1000 * 60 * 60);
  let silenceScore01 = 0;
  if (hours >= 0.5) silenceScore01 = 0.25;
  if (hours >= 2) silenceScore01 = 0.45;
  if (hours >= 8) silenceScore01 = 0.62;
  if (hours >= 24) silenceScore01 = 0.78;
  if (hours >= 72) silenceScore01 = 0.9;

  const suggestFollowupWait = hours >= 4 || silenceScore01 >= 0.55;

  return {
    silenceScore01,
    suggestFollowupWait,
    hoursSinceLastActivity: hours > 0 ? Math.round(hours * 10) / 10 : undefined,
  };
}
