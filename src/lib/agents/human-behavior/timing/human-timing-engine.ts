import "server-only";

import type { ProspectEmotion } from "../emotions/emotion-detector";
import { emotionDelayFactor } from "../emotions/emotion-detector";
import type { BusinessDaySlot } from "./time-context";

export type HumanTimingInput = {
  /** Texte utilisateur (longueur + ponctuation). */
  prospectMessage: string;
  emotion: ProspectEmotion;
  /** Créneau local boutique. */
  daySlot: BusinessDaySlot;
  /** Longueur de la réponse assistant prévue (estimation avant envoi : utiliser brouillon ou message user). */
  replyCharEstimate?: number;
  /** Heure locale boutique 0–23 (variation « humaine » + nuit). */
  hourLocal?: number;
  /** Graine stable (ex. hash message) pour délais irréguliers entre deux tours similaires. */
  delaySeed?: string;
};

function complexityScore(text: string): number {
  const t = String(text ?? "").trim();
  if (!t) return 0;
  const words = t.split(/\s+/).length;
  const questions = (t.match(/\?/g) ?? []).length;
  const digits = (t.match(/\d/g) ?? []).length;
  return Math.min(1, words / 80 + questions * 0.12 + digits * 0.02);
}

function seedHash32(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/**
 * Variation de délai « humaine » (irrégulière : 6 s, 8 s, 14 s, 21 s… selon contexte).
 * Retourne un multiplicateur appliqué au délai de base (≈0.62–1.48).
 */
export function humanDelayVariation(input: {
  seed: string;
  emotion: ProspectEmotion;
  replyCharEstimate: number;
  hourLocal: number;
  daySlot: BusinessDaySlot;
}): number {
  const h = seedHash32(input.seed || "x");
  const waves = [0.68, 0.82, 0.94, 1.06, 1.18, 1.32, 0.76, 1.1, 0.88, 1.24];
  let m = waves[h % waves.length]!;

  const hour = input.hourLocal;
  if (hour >= 22 || hour < 5) m *= 1.14;
  if (input.daySlot === "night") m *= 1.08;

  const len = Math.min(1, Math.max(0, (input.replyCharEstimate ?? 80) / 360));
  m += (len - 0.22) * 0.2;

  if (input.emotion === "impatience") m *= 0.74;
  if (input.emotion === "anger" || input.emotion === "frustration") m *= 0.9;
  if (input.emotion === "purchase_interest") m *= 0.86;

  const spike = ((h >>> 8) % 5) * 0.034;
  return Math.max(0.62, Math.min(1.48, m + spike));
}

/**
 * Délai total suggéré avant d’afficher / envoyer la réponse (ms).
 * Jamais 0 : une réponse instantanée paraît artificielle.
 */
export function computeHumanResponseDelayMs(input: HumanTimingInput): number {
  const readMs = Math.min(4500, 220 + String(input.prospectMessage ?? "").length * 18);
  const thinkMs = 280 + complexityScore(input.prospectMessage) * 1200;
  const typeMs = Math.min(3200, 120 + (input.replyCharEstimate ?? 80) * 22);

  let base = readMs * 0.35 + thinkMs * 0.45 + typeMs * 0.2;
  /** Friction : un peu plus de « lecture » avant de répondre. */
  if (input.emotion === "anger" || input.emotion === "frustration") {
    base += 380 + Math.min(1200, String(input.prospectMessage ?? "").length * 6);
  }
  base *= emotionDelayFactor(input.emotion);

  // Nuit locale : léger délai sup. (prise en main plus lente), sauf impatience.
  if ((input.daySlot === "night" || input.daySlot === "evening") && input.emotion !== "impatience") {
    base *= 1.08;
  }

  const hour = typeof input.hourLocal === "number" ? input.hourLocal : 12;
  const variation = humanDelayVariation({
    seed: input.delaySeed ?? input.prospectMessage,
    emotion: input.emotion,
    replyCharEstimate: input.replyCharEstimate ?? 80,
    hourLocal: hour,
    daySlot: input.daySlot,
  });
  base *= variation;

  const jitter = ((String(input.prospectMessage).length * 13) % 180) - 90;
  const out = Math.round(base + jitter);

  const minDelay = input.emotion === "impatience" ? 350 : input.emotion === "purchase_interest" ? 420 : 520;
  const maxDelay =
    input.emotion === "purchase_interest"
      ? hour >= 22 || hour < 5
        ? 9000
        : 8200
      : hour >= 22 || hour < 5
        ? 12_000
        : 10_000;
  return Math.max(minDelay, Math.min(maxDelay, out));
}

/** Délai de frappe simulé pour une réponse déjà connue (ms). */
export function computeTypingDelayMs(replyText: string, emotion: ProspectEmotion, hourLocal?: number): number {
  const len = String(replyText ?? "").length;
  const cps =
    emotion === "impatience"
      ? 42
      : emotion === "purchase_interest"
        ? 36
        : emotion === "hesitation"
          ? 22
          : emotion === "anger" || emotion === "frustration"
            ? 19
            : 30;
  let raw = 400 + (len / cps) * 1000;
  if (emotion === "anger" || emotion === "frustration") raw += 420;
  const h = hourLocal;
  if (typeof h === "number" && (h >= 22 || h < 5)) raw *= 1.12;
  return Math.max(420, Math.min(8200, Math.round(raw)));
}
