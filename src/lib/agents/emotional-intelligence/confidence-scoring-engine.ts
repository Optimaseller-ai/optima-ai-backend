import type { DominantEmotion } from "./types";

/** Confiance d’achat et confort conversationnel (0–1). */
export function computeBuyingConfidence(args: {
  dominantEmotion: DominantEmotion;
  trust01: number;
  message: string;
  turnCount?: number;
}): { buyingConfidence: number; conversationComfort: number; patienceLevel: number } {
  let buying = 0.42;
  let comfort = 0.55;
  let patience = 0.6;

  const m = String(args.message ?? "").toLowerCase();

  switch (args.dominantEmotion) {
    case "confidence":
    case "enthusiasm":
    case "excitement":
      buying = 0.82;
      comfort = 0.78;
      patience = 0.7;
      break;
    case "frustration":
    case "mild_anger":
      buying = 0.18;
      comfort = 0.28;
      patience = 0.22;
      break;
    case "scam_fear":
    case "hesitation":
      buying = 0.32;
      comfort = 0.38;
      patience = 0.55;
      break;
    case "purchase_stress":
    case "emotional_urgency":
    case "impatience":
      buying = 0.68;
      comfort = 0.48;
      patience = 0.25;
      break;
    case "confusion":
      buying = 0.35;
      comfort = 0.42;
      patience = 0.5;
      break;
    case "satisfaction":
      buying = 0.72;
      comfort = 0.85;
      patience = 0.75;
      break;
    default:
      break;
  }

  buying = buying * 0.7 + args.trust01 * 0.3;
  if (/\b(je commande|je prends|lien de paiement|valider)\b/i.test(m)) buying = Math.min(0.95, buying + 0.15);
  if (/\b(non merci|pas maintenant|stop)\b/i.test(m)) buying = Math.max(0.1, buying - 0.25);

  const turns = args.turnCount ?? 0;
  if (turns > 18) comfort = Math.max(0.25, comfort - 0.08);
  if (turns > 28) patience = Math.max(0.2, patience - 0.1);

  return {
    buyingConfidence: Math.max(0, Math.min(1, buying)),
    conversationComfort: Math.max(0, Math.min(1, comfort)),
    patienceLevel: Math.max(0, Math.min(1, patience)),
  };
}

/** Risque d’abandon (0–1) pour insights superviseur. */
export function computeAbandonmentRisk(args: {
  frustrationLevel: number;
  trust01: number;
  buyingConfidence: number;
  patienceLevel: number;
}): "low" | "medium" | "high" {
  const score =
    args.frustrationLevel * 0.4 +
    (1 - args.trust01) * 0.3 +
    (1 - args.buyingConfidence) * 0.15 +
    (1 - args.patienceLevel) * 0.15;
  if (score >= 0.62) return "high";
  if (score >= 0.38) return "medium";
  return "low";
}

export function computeRelationalQuality(args: {
  trust01: number;
  conversationComfort: number;
  frustrationLevel: number;
}): "fragile" | "developing" | "solid" {
  if (args.frustrationLevel > 0.55 || args.trust01 < 0.35) return "fragile";
  if (args.trust01 > 0.65 && args.conversationComfort > 0.6) return "solid";
  return "developing";
}
