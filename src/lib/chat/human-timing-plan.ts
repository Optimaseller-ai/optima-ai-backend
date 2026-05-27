/**
 * Plan de timing humain unifié — lecture, réflexion, frappe (client chat).
 */

import type { ProspectTone } from "@/lib/chat/seller-behavior-types";
import { inferBusyState, type BusyStateLevel } from "@/lib/chat/busy-state";
import { computeHumanReadDelayMs } from "@/lib/chat/human-read-delay";
import { computePauseAfterSeenMs, computeReflectionBeforeTypingMs } from "@/lib/chat/human-thinking-delay";
import { computeHumanTypingDurationMs } from "@/lib/chat/human-typing-rhythm";

export type HumanTimingPlanInput = {
  userMessage: string;
  seed: string;
  hourLocal?: number;
  fatigue01?: number;
  profileTone?: ProspectTone;
  turnCount?: number;
  replyText?: string;
  rushed?: boolean;
};

export type HumanTimingPlan = {
  readDelayMs: number;
  pauseAfterSeenMs: number;
  reflectionBeforeTypingMs: number;
  minTypingMs: number;
  busyLevel: BusyStateLevel;
  nightMode: boolean;
};

export function buildHumanTimingPlan(input: HumanTimingPlanInput): HumanTimingPlan {
  const hour = typeof input.hourLocal === "number" ? input.hourLocal : new Date().getHours();
  const nightMode = hour >= 23 || hour < 5;
  const busyLevel = inferBusyState(input.seed, input.turnCount ?? 0);

  const base = {
    userMessage: input.userMessage,
    seed: input.seed,
    hourLocal: hour,
    fatigue01: input.fatigue01,
    profileTone: input.profileTone,
    turnCount: input.turnCount,
    busyLevel,
  };

  const readDelayMs = computeHumanReadDelayMs(base);
  const pauseAfterSeenMs = computePauseAfterSeenMs(base);
  const reflectionBeforeTypingMs = computeReflectionBeforeTypingMs(base);

  const minTypingMs = input.replyText
    ? computeHumanTypingDurationMs({
        reply: input.replyText,
        seed: input.seed,
        hourLocal: hour,
        rushed: input.rushed,
        fatigue01: input.fatigue01,
        busyLevel,
      })
    : computeHumanTypingDurationMs({
        reply: "…",
        seed: input.seed + "pre",
        hourLocal: hour,
        fatigue01: input.fatigue01,
        busyLevel,
      });

  return {
    readDelayMs,
    pauseAfterSeenMs,
    reflectionBeforeTypingMs,
    minTypingMs,
    busyLevel,
    nightMode,
  };
}

/** Durée totale minimale avant d’afficher le typing (anti-robot). */
export function minTotalBeforeTypingMs(plan: HumanTimingPlan): number {
  return plan.readDelayMs + plan.pauseAfterSeenMs + plan.reflectionBeforeTypingMs;
}
