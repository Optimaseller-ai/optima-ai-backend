import "server-only";

import type { BuyingIntentPhase } from "../intent-analysis/buying-intent-engine";
import type { ConversationProfile } from "@/lib/agents/memory/conversation-state";

export type SalesTemperature = "cold" | "warm" | "hot" | "ready_to_buy" | "customer";

export type SalesTemperatureSnapshot = {
  temperature: SalesTemperature;
  /** 1 = lent / peu commercial, 3 = équilibré, 5 = direct */
  conversationalPaceHint: number;
  /** 0–1 fréquence de micro-finitions commerciales */
  commercialCadenceHint: number;
  /** niveau closing suggéré 1–3 */
  closingIntensityHint: number;
};

/** Température + vitesses conseillées (pour prompt & timing). */
export function inferSalesTemperature(args: {
  buyingPhase: BuyingIntentPhase;
  intentScore: number;
  conversationProfile?: ConversationProfile;
  turnCount?: number;
}): SalesTemperatureSnapshot {
  const bp = args.buyingPhase;
  const score = args.intentScore;
  const tone = args.conversationProfile?.tone ?? "neutral";
  const bi = args.conversationProfile?.buyingIntent ?? 35;

  // Client récurrent
  const customerLike = tone === "loyal";

  if (customerLike) {
    return {
      temperature: "customer",
      conversationalPaceHint: 4,
      commercialCadenceHint: 0.45,
      closingIntensityHint: 2,
    };
  }

  if (bp === "imminent_purchase" || score >= 86 || tone === "ready_to_buy" || bi >= 78) {
    return {
      temperature: "ready_to_buy",
      conversationalPaceHint: 5,
      commercialCadenceHint: 0.7,
      closingIntensityHint: 3,
    };
  }

  if (bp === "purchase_intent" || score >= 72 || bi >= 62) {
    return { temperature: "hot", conversationalPaceHint: 4, commercialCadenceHint: 0.55, closingIntensityHint: 3 };
  }

  if (bp === "real_interest" || bp === "comparison" || score >= 45 || bi >= 42) {
    return { temperature: "warm", conversationalPaceHint: 3, commercialCadenceHint: 0.38, closingIntensityHint: 2 };
  }

  const turns = Math.max(0, args.turnCount ?? 0);
  if (turns > 14 && bp === "hesitation") {
    return { temperature: "cold", conversationalPaceHint: 2, commercialCadenceHint: 0.18, closingIntensityHint: 1 };
  }

  return { temperature: "cold", conversationalPaceHint: 2, commercialCadenceHint: 0.22, closingIntensityHint: 1 };
}
