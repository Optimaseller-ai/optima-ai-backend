import "server-only";

import type { BusinessDaySlot } from "@/lib/agents/human-behavior/timing/time-context";

export type MobileBehaviorPhase = "read" | "think" | "type" | "resume";

export type MobileBehaviorTiming = {
  readPauseMs: number;
  thinkPauseMs: number;
  typingProgressiveMs: number;
  resumeBumpMs: number;
  microInterruptMs: number;
  phase: MobileBehaviorPhase;
};

function seedHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/** Micro-délais type humain sur téléphone (lecture → réflexion → frappe progressive). */
export function computeMobileBehaviorTiming(args: {
  userMessage: string;
  replyChars: number;
  daySlot: BusinessDaySlot;
  delaySeed?: string;
  fatigue?: number;
}): MobileBehaviorTiming {
  const msg = String(args.userMessage ?? "").trim();
  const len = Math.max(0, args.replyChars);
  const fatigue = Math.max(0, Math.min(1, args.fatigue ?? 0));
  const roll = seedHash(`${args.delaySeed ?? ""}|${msg}|${len}`) % 100;

  const shortUser = msg.length < 28;
  const question = /\?/.test(msg);
  const urgent = /\b(urgent|vite|maintenant|now|asap)\b/i.test(msg);

  let readPauseMs = shortUser ? 380 + (roll % 420) : 720 + (roll % 900);
  if (question) readPauseMs += 180;
  if (urgent) readPauseMs = Math.min(readPauseMs, 650);

  let thinkPauseMs = shortUser ? 240 + (roll % 380) : 520 + (roll % 680);
  if (len > 180) thinkPauseMs += 220;
  if (args.daySlot === "night") thinkPauseMs += 140;

  let typingProgressiveMs = Math.min(4200, 28 * Math.sqrt(len) + (roll % 320));
  if (args.daySlot === "evening" || args.daySlot === "night") typingProgressiveMs += 180;

  const resumeBumpMs = roll < 18 ? 160 + (roll % 240) : 0;
  const microInterruptMs = roll > 82 && len > 90 ? 90 + (roll % 120) : 0;

  readPauseMs += Math.round(fatigue * 220);
  thinkPauseMs += Math.round(fatigue * 160);
  typingProgressiveMs += Math.round(fatigue * 280);

  const phase: MobileBehaviorPhase =
    resumeBumpMs > 0 ? "resume" : typingProgressiveMs > thinkPauseMs ? "type" : thinkPauseMs > readPauseMs ? "think" : "read";

  return {
    readPauseMs,
    thinkPauseMs,
    typingProgressiveMs,
    resumeBumpMs,
    microInterruptMs,
    phase,
  };
}
