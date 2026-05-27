/**
 * Rythme de frappe humain — durée variable, pauses, multi-bulles.
 */

import { busyStateMultipliers, type BusyStateLevel } from "@/lib/chat/busy-state";
import { seededMs } from "@/lib/chat/human-read-delay";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export type HumanTypingRhythmInput = {
  reply: string;
  seed: string;
  hourLocal?: number;
  rushed?: boolean;
  fatigue01?: number;
  busyLevel?: BusyStateLevel;
};

const MIN_TYPING_MS = 3200;

/** Durée minimale d’affichage « typing » avant envoi — dépend de la longueur de réponse. */
export function computeHumanTypingDurationMs(input: HumanTypingRhythmInput): number {
  const len = String(input.reply ?? "").trim().length;
  const hour = typeof input.hourLocal === "number" ? input.hourLocal : new Date().getHours();

  let min: number;
  let max: number;
  if (len < 45) {
    min = 3200;
    max = 6800;
  } else if (len < 120) {
    min = 4500;
    max = 10_500;
  } else if (len < 260) {
    min = 6000;
    max = 14_500;
  } else {
    min = 8000;
    max = 18_000;
  }

  let ms = seededMs(input.seed, `type${len}`, min, max);

  const f = clamp(0, input.fatigue01 ?? 0, 1);
  ms += Math.round(600 * f);

  if (hour >= 23) ms = Math.round(ms * 1.26);
  else if (hour >= 22) ms = Math.round(ms * 1.1);

  if (input.rushed) ms = Math.round(ms * 0.94);
  ms = Math.round(ms * busyStateMultipliers(input.busyLevel ?? "normal").typing);

  return clamp(MIN_TYPING_MS, ms, 22_000);
}

/** Pause entre deux bulles assistant (multi-messages). */
export function computeMultiBubblePauseMs(args: {
  bubble: string;
  nextBubble?: string;
  seed: string;
  bubbleIndex: number;
  hourLocal?: number;
}): number {
  const b = String(args.bubble ?? "").trim();
  const next = String(args.nextBubble ?? "").trim();
  const hour = typeof args.hourLocal === "number" ? args.hourLocal : new Date().getHours();

  const tiny = b.length < 22;
  const producty =
    /\b(fcfa|cfa|€|stock|dispo|disponible|pointure|taille|couleur|prix|commande)\b/i.test(b) ||
    /\b(fcfa|cfa|€)\b/i.test(next);

  let min = tiny ? 1800 : 2400;
  let max = tiny ? 4200 : producty ? 7500 : 5800;

  if (args.bubbleIndex > 0) {
    min += 400;
    max += 800;
  }

  let ms = seededMs(args.seed, `bubbleGap${args.bubbleIndex}`, min, max);
  if (hour >= 23) ms = Math.round(ms * 1.15);

  return clamp(1200, ms, 9500);
}

export type TypingRhythmBeat = { typingVisibleMs: number; typingHiddenMs: number };

/** Séquence typing → pause → typing pendant l’attente API. */
export function nextTypingRhythmBeat(seed: string, stepIndex: number): TypingRhythmBeat {
  const visibleMs = seededMs(seed, `tVis${stepIndex}`, 1800, 5200);
  const hiddenMs = seededMs(seed, `tHid${stepIndex}`, 900, 2800);
  return { typingVisibleMs: visibleMs, typingHiddenMs: hiddenMs };
}

export function shouldApplyTypingRhythmBeat(seed: string, stepIndex: number, elapsedWaitMs: number): boolean {
  if (elapsedWaitMs < 2800) return false;
  const h = seededMs(seed, `tBeat${stepIndex}`, 0, 99);
  return h < 72;
}
