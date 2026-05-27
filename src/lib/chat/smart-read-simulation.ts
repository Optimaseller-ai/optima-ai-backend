/**
 * Simulation « lecture humaine » avant statut « vu » (client chat).
 * Pas server-only — importable côté client.
 */

import { inferConversationEmotionalTemperature } from "@/lib/agents/human-behavior/emotions/conversation-emotion";
import type { ProspectTone } from "@/lib/chat/seller-behavior-types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hourBucket(h: number) {
  if (h >= 6 && h <= 11) return "morning";
  if (h >= 12 && h <= 17) return "afternoon";
  if (h >= 18 && h <= 22) return "evening";
  return "night";
}

export function isBareAcknowledgmentMessage(userMessage: string): boolean {
  const m = String(userMessage ?? "")
    .trim()
    .toLowerCase();
  return /^(ok|okay|k|d['’']accord|dac|bien|parfait|merci|mercii|cool|thanks|thank you|thx|vale|👍|🙏|👌)$/i.test(m);
}

function isPurchaseReadyMessage(userMessage: string): boolean {
  const m = String(userMessage ?? "").toLowerCase();
  return /\b(je\s+prends|je\s+commande|je\s+valide|ok\s+je\s+prends|je\s+r[eè]gle|j['’']achète)\b/i.test(m);
}

function isRushedMessage(userMessage: string): boolean {
  const msg = String(userMessage ?? "").trim();
  const m = msg.toLowerCase();
  if (msg.length <= 3) return true;
  if (msg.length <= 10 && !/[?.!]/.test(msg)) return true;
  if (/^(prix|prx|combien|dispo|stock|taille|couleur|adresse|où|ou|livraison|payer|paiement)\s*\??$/i.test(m)) return true;
  if (/\b(vite|urgent|tt suite|tout de suite|maintenant)\b/i.test(m)) return true;
  return false;
}

function isTalkativeMessage(userMessage: string): boolean {
  const msg = String(userMessage ?? "").trim();
  const wc = msg.split(/\s+/).filter(Boolean).length;
  return msg.length >= 170 || wc >= 30;
}

/**
 * Délai ms avant d’afficher « vu » / lecture réaliste (long message → 8–20 s typique).
 */
export function smartReadSimulationMs(args: {
  userMessage: string;
  fatigue01: number;
  profileTone?: ProspectTone;
  /** Heure locale appareil (0–23) ; défaut = now */
  hourLocal?: number;
}): number {
  const msg = String(args.userMessage ?? "");
  const len = msg.trim().length;
  const hour = typeof args.hourLocal === "number" ? args.hourLocal : new Date().getHours();
  const bucket = hourBucket(hour);
  const temp = inferConversationEmotionalTemperature(msg);
  const rushed = isRushedMessage(msg);
  const talkative = isTalkativeMessage(msg);
  const bare = isBareAcknowledgmentMessage(msg);
  const purchaseReady = isPurchaseReadyMessage(msg);
  const f = clamp(0, args.fatigue01, 1);
  const after23 = hour >= 23;

  if (purchaseReady) {
    const ms = 900 + Math.round(Math.random() * 2200);
    return clamp(800, ms, 3600);
  }
  if (rushed) {
    const ms = 800 + Math.round(Math.random() * 2400);
    return clamp(700, ms, 4200);
  }

  const complexity =
    len > 80 ||
    /(comment|pourquoi|livraison|adresse|paiement|payer|garantie|retour|échange|remboursement|taille|couleur|disponible|stock|compar|moins cher|budget|max)/i.test(
      msg,
    );
  const longMsg = len > 100;

  let min: number;
  let max: number;
  if (bare) {
    min = 5200;
    max = 14_000;
  } else if (longMsg) {
    min = 8000;
    max = 20_000;
  } else if (complexity) {
    min = 4200;
    max = 16_000;
  } else {
    min = 1600;
    max = 5600;
  }

  let base = min + Math.round(Math.random() * Math.max(0, max - min));
  const byTalkative = talkative ? 500 : 0;
  const byTime = bucket === "night" ? 1000 : bucket === "evening" ? 480 : 0;
  const byAfter23 = after23 ? 900 + Math.round(Math.random() * 1600) : 0;
  const byFatigue = Math.round(520 * f);
  const hesitant = args.profileTone === "hesitant" ? 800 + Math.round(Math.random() * 2200) : 0;
  const aggressive = args.profileTone === "aggressive" ? 300 + Math.round(Math.random() * 500) : 0;

  if (temp === "irrité" || temp === "frustré") {
    base = Math.max(min, Math.round(base * 0.88) - 400);
  }
  if (temp === "prêt_achat") {
    base = Math.max(min, Math.round(base * 0.82));
  }

  const out = Math.round(base + byTalkative + byTime + byAfter23 + byFatigue + hesitant + aggressive);
  const cap = (longMsg ? 22_000 : complexity ? 18_000 : 9000) + (after23 ? 3500 : 0);
  return clamp(min, out, cap);
}
