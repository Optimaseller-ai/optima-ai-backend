import "server-only";

import type { ProspectEmotion } from "../emotions/emotion-detector";
import type { ResponseDensityV2 } from "./response-density-v2";

export type DigitalHumanRhythm = {
  hesitationPauseMs: number;
  reflectionBumpMs: number;
  resumeTypingMs: number;
  microInterruptMs: number;
};

function h01(s: string, salt: string): number {
  let x = 2166136261;
  const t = `${s}|${salt}`;
  for (let i = 0; i < t.length; i++) {
    x ^= t.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return (x >>> 0) / 4294967296;
}

/** Pauses / micro-interruptions digitales (coefficients modérés — cumul L14–L16). */
export function computeDigitalHumanRhythm(args: {
  microSeed: string;
  density: ResponseDensityV2;
  fatigue01: number;
  emotion: ProspectEmotion;
  replyChars: number;
}): DigitalHumanRhythm {
  const r = h01(args.microSeed, `rhythm|${args.density}|${args.replyChars}`);
  const frustrated = args.emotion === "frustration" || args.emotion === "anger";

  let hesitationPauseMs = Math.round((40 + r * 280 + args.fatigue01 * 120) * 0.38);
  let reflectionBumpMs = Math.round((args.replyChars > 220 ? 70 : 35) + r * 160 * 0.38);
  let resumeTypingMs = Math.round((25 + args.replyChars * 1.8) * 0.28);
  let microInterruptMs = r < 0.08 ? Math.round((120 + r * 400) * 0.32) : 0;

  if (args.density === "ultra_short") {
    hesitationPauseMs = Math.round(hesitationPauseMs * 0.55);
    reflectionBumpMs = Math.round(reflectionBumpMs * 0.55);
    resumeTypingMs = Math.round(resumeTypingMs * 0.55);
  }
  if (args.density === "expanded") {
    hesitationPauseMs = Math.round(hesitationPauseMs * 1.15);
    reflectionBumpMs = Math.round(reflectionBumpMs * 1.12);
  }
  if (frustrated) {
    hesitationPauseMs = Math.round(hesitationPauseMs * 0.65);
    microInterruptMs = 0;
  }

  return { hesitationPauseMs, reflectionBumpMs, resumeTypingMs, microInterruptMs };
}
