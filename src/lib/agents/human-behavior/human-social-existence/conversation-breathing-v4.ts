import "server-only";

function hash01(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return ((h >>> 0) % 10007) / 10007;
}

/** Respiration conversationnelle : micro-pause avant de « répondre » (UX), déterministe. */
export function computeConversationBreathingV4Ms(args: {
  microSeed: string;
  userMessage: string;
  replyLen: number;
  lateFactor01: number;
}): number {
  const base = hash01(`${args.microSeed}|breathe|${args.userMessage.length}|${args.replyLen}`);
  if (base > 0.72) return 0;
  const core = 60 + Math.round(base * 500);
  const lateBoost = Math.round(args.lateFactor01 * 220);
  return core + lateBoost;
}
