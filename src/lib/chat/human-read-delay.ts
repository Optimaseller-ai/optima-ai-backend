/**
 * Délai avant affichage « Vu » — lecture humaine réaliste (jamais instantané).
 */

import { inferConversationEmotionalTemperature } from "@/lib/agents/human-behavior/emotions/conversation-emotion";
import type { ProspectTone } from "@/lib/chat/seller-behavior-types";
import { busyStateMultipliers, inferBusyState, type BusyStateLevel } from "@/lib/chat/busy-state";

export type MessageReadTier = "short" | "medium" | "long";

const GLOBAL_MIN_MS = 4000;
const GLOBAL_MAX_MS = 38_000;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/** Délais pseudo-aléatoires stables par tour (évite 6s / 6s / 6s). */
export function seededMs(seed: string, salt: string, min: number, max: number): number {
  const h = seedHash(`${seed}\0${salt}`);
  const span = Math.max(0, max - min);
  return min + (h % (span + 1));
}

export function classifyMessageReadTier(userMessage: string): MessageReadTier {
  const msg = String(userMessage ?? "").trim();
  const len = msg.length;
  const complex =
    len > 80 ||
    /(comment|pourquoi|livraison|adresse|paiement|payer|garantie|retour|échange|remboursement|taille|couleur|disponible|stock|compar|moins cher|budget|max)/i.test(
      msg,
    );
  if (len > 100 || complex) return "long";
  if (len <= 28 && !complex) return "short";
  return "medium";
}

function tierBounds(tier: MessageReadTier): { min: number; max: number } {
  switch (tier) {
    case "short":
      return { min: 4000, max: 9000 };
    case "medium":
      return { min: 8000, max: 18_000 };
    case "long":
      return { min: 15_000, max: 35_000 };
  }
}

export type HumanReadDelayInput = {
  userMessage: string;
  seed: string;
  hourLocal?: number;
  fatigue01?: number;
  profileTone?: ProspectTone;
  turnCount?: number;
  busyLevel?: BusyStateLevel;
};

/**
 * Ms avant d’afficher « Vu » / lecture.
 */
export function computeHumanReadDelayMs(input: HumanReadDelayInput): number {
  const msg = String(input.userMessage ?? "");
  const hour = typeof input.hourLocal === "number" ? input.hourLocal : new Date().getHours();
  const tier = classifyMessageReadTier(msg);
  const { min, max } = tierBounds(tier);
  let ms = seededMs(input.seed, "read", min, max);

  const temp = inferConversationEmotionalTemperature(msg);
  if (temp === "frustré" || temp === "irrité") {
    ms = Math.round(ms * 1.08);
  } else if (temp === "prêt_achat") {
    ms = Math.round(ms * 0.92);
  }

  if (input.profileTone === "hesitant") ms += seededMs(input.seed, "hesitant", 600, 2200);
  if (input.profileTone === "aggressive") ms += seededMs(input.seed, "aggro", 400, 1400);

  const f = clamp(0, input.fatigue01 ?? 0, 1);
  ms += Math.round(400 * f);

  if (hour >= 23 || hour < 5) {
    ms = Math.round(ms * (hour >= 23 ? 1.28 : 1.18));
  } else if (hour >= 22) {
    ms = Math.round(ms * 1.12);
  }

  const busy = input.busyLevel ?? inferBusyState(input.seed, input.turnCount ?? 0);
  ms = Math.round(ms * busyStateMultipliers(busy).read);

  return clamp(GLOBAL_MIN_MS, ms, GLOBAL_MAX_MS);
}
