import "server-only";

function hash01(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) >>> 0;
  }
  return h / 4294967296;
}

export type ConversationPacingV4 = {
  readSimMs: number;
  thinkPauseMs: number;
  typingProgressiveMs: number;
  microInterruptMs: number;
};

/**
 * Rythme humain v4 : lecture → réflexion → frappe progressive → mini-interruption optionnelle.
 */
export function computeConversationPacingV4(args: {
  microSeed: string;
  userMessage: string;
  replyCharCount: number;
  lateFactor01: number;
  preferShorter: boolean;
}): ConversationPacingV4 {
  const r1 = hash01(`${args.microSeed}|p4r|${args.userMessage.slice(0, 40)}`);
  const r2 = hash01(`${args.microSeed}|p4t|${args.replyCharCount}`);
  const len = Math.min(800, args.userMessage.length);
  const readSimMs = Math.round((80 + len * 2.2 * (0.6 + r1) + args.lateFactor01 * 140) * 0.45);
  const thinkPauseMs = Math.round(
    ((args.preferShorter ? 90 : 140) + r2 * 520 + (args.replyCharCount > 220 ? 110 : 0) + args.lateFactor01 * 180) * 0.45,
  );
  const typingProgressiveMs = Math.round((40 + args.replyCharCount * 3.1 * (0.5 + r1 * 0.5)) * 0.35);
  const microInterruptMs = r2 < 0.12 ? Math.round((180 + r1 * 400) * 0.4) : 0;
  return { readSimMs, thinkPauseMs, typingProgressiveMs, microInterruptMs };
}
