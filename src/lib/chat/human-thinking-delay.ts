/**
 * Délai entre « Vu » et début de frappe — réflexion humaine avant typing.
 */

import { inferConversationEmotionalTemperature } from "@/lib/agents/human-behavior/emotions/conversation-emotion";
import { computeResponseWeight } from "@/lib/agents/human-behavior/response-weight-system";
import type { ProspectTone } from "@/lib/chat/seller-behavior-types";
import { busyStateMultipliers, type BusyStateLevel } from "@/lib/chat/busy-state";
import { classifyMessageReadTier, seededMs } from "@/lib/chat/human-read-delay";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export type HumanThinkingDelayInput = {
  userMessage: string;
  seed: string;
  hourLocal?: number;
  fatigue01?: number;
  profileTone?: ProspectTone;
  busyLevel?: BusyStateLevel;
};

/** Pause après « Vu », avant phase réflexion visible (souvent 5–12 s). */
export function computePauseAfterSeenMs(input: HumanThinkingDelayInput): number {
  const hour = typeof input.hourLocal === "number" ? input.hourLocal : new Date().getHours();
  let ms = seededMs(input.seed, "pauseSeen", 5000, 12_000);

  if (hour >= 23) ms = Math.round(ms * 1.22);
  ms = Math.round(ms * busyStateMultipliers(input.busyLevel ?? "normal").pauseAfterSeen);

  return clamp(4500, ms, 16_000);
}

/** Réflexion avant indicateur « en train d’écrire » (en plus de la pause post-vu). */
export function computeReflectionBeforeTypingMs(input: HumanThinkingDelayInput): number {
  const msg = String(input.userMessage ?? "").trim();
  const tier = classifyMessageReadTier(msg);
  const temp = inferConversationEmotionalTemperature(msg);
  const weight = computeResponseWeight(msg);
  const hour = typeof input.hourLocal === "number" ? input.hourLocal : new Date().getHours();

  let min = 4000;
  let max = 14_000;
  if (tier === "short") {
    min = 3500;
    max = 9000;
  } else if (tier === "long") {
    min = 7000;
    max = 22_000;
  }

  if (temp === "frustré" || temp === "irrité") {
    min += 1200;
    max += 4000;
  }
  if (temp === "hésitant") {
    min += 800;
    max += 2500;
  }
  if (weight.tier === "heavy") {
    min += 1500;
    max += 5000;
  }

  let ms = seededMs(input.seed, "reflect", min, max);

  if (input.profileTone === "hesitant") ms += seededMs(input.seed, "reflHes", 800, 2800);
  if (hour >= 23) ms = Math.round(ms * 1.2);
  ms = Math.round(ms * busyStateMultipliers(input.busyLevel ?? "normal").reflection);

  return clamp(3000, ms, 26_000);
}
