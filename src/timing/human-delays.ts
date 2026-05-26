/**
 * Human delay calculators — branchés par l'orchestrateur (phase 2).
 */

export function computeReadDelayMs(opts: { messageLen: number; hourLocal: number }): number {
  const base = 800 + Math.min(opts.messageLen * 8, 2400);
  const night = opts.hourLocal >= 22 || opts.hourLocal < 7 ? 400 : 0;
  return base + night;
}

export function computeTypingDelayMs(opts: { replyLen: number; rushed?: boolean }): number {
  const base = 1200 + Math.min(opts.replyLen * 12, 8000);
  return opts.rushed ? Math.round(base * 0.65) : base;
}

export function computeFollowUpDelayMs(): number {
  return 45_000 + Math.round(Math.random() * 30_000);
}
