import "server-only";

import type { BusinessTimeContext } from "../timing/time-context";

export type HumanizedDigitalFatigue = {
  /** 0–1 : nuit / fin de journée */
  lateFactor01: number;
  /** Ralentissement tying (ms) */
  typingSlowdownMs: number;
  /** Pauses lecture / réflexion additionnelles */
  calmReadExtraMs: number;
  /** Consigne : plus concis */
  preferShorter: boolean;
};

/** Très tard : plus calme, concis, légèrement plus lent (comme un humain). */
export function inferHumanizedDigitalFatigue(ctx: BusinessTimeContext): HumanizedDigitalFatigue {
  const h = typeof ctx.hour === "number" ? ctx.hour : 12;
  const slot = ctx.daySlot;
  let lateFactor01 = 0;
  if (slot === "night" || h >= 23 || h < 5) lateFactor01 = 0.85;
  else if (h >= 21) lateFactor01 = 0.55;
  else if (h >= 19) lateFactor01 = 0.25;

  const typingSlowdownMs = Math.round(90 + lateFactor01 * 420);
  const calmReadExtraMs = Math.round(lateFactor01 * 380);
  const preferShorter = lateFactor01 > 0.45;

  return { lateFactor01, typingSlowdownMs, calmReadExtraMs, preferShorter };
}
