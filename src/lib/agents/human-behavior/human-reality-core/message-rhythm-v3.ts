import "server-only";

import type { DigitalAtmosphereSnapshot } from "./digital-atmosphere";
import type { SocialStateMemorySnapshot } from "./social-state-memory";
import type { AdvancedSocialSignal } from "./social-understanding-advanced";

export type MessageRhythmV3 = {
  readPauseExtraMs: number;
  typingVarianceMs: number;
  interBubblePauseExtraMs: number;
  note: string;
};

export function computeMessageRhythmV3(args: {
  microSeed: string;
  atmosphere: DigitalAtmosphereSnapshot;
  social: SocialStateMemorySnapshot;
  advanced: AdvancedSocialSignal;
  replyCharCount: number;
}): MessageRhythmV3 {
  let readPauseExtraMs = 180;
  let typingVarianceMs = 120;
  let interBubblePauseExtraMs = 90;

  switch (args.atmosphere.atmosphere) {
    case "late_night_quiet":
      readPauseExtraMs += 220;
      typingVarianceMs += 180;
      interBubblePauseExtraMs += 140;
      break;
    case "evening_soft":
    case "weekend_ease":
      readPauseExtraMs += 110;
      typingVarianceMs += 90;
      interBubblePauseExtraMs += 60;
      break;
    case "midday_busy":
      readPauseExtraMs -= 40;
      typingVarianceMs -= 30;
      break;
    default:
      break;
  }

  if (args.social.rhythm === "slow") {
    readPauseExtraMs += 100;
    interBubblePauseExtraMs += 70;
  }
  if (args.social.rhythm === "fast") {
    readPauseExtraMs -= 50;
    interBubblePauseExtraMs -= 30;
  }

  if (args.advanced.frustration || args.advanced.weariness) {
    readPauseExtraMs += 80;
    typingVarianceMs += 50;
  }

  let h = 0;
  for (let i = 0; i < args.microSeed.length; i++) h = (h * 31 + args.microSeed.charCodeAt(i)) >>> 0;
  typingVarianceMs += (h % 5) * 45;

  readPauseExtraMs = Math.max(0, readPauseExtraMs);
  typingVarianceMs = Math.max(40, typingVarianceMs);
  interBubblePauseExtraMs = Math.max(0, interBubblePauseExtraMs);

  return {
    readPauseExtraMs,
    typingVarianceMs,
    interBubblePauseExtraMs,
    note: `L15 rhythm atmosphere=${args.atmosphere.atmosphere} rhythm=${args.social.rhythm}`,
  };
}
