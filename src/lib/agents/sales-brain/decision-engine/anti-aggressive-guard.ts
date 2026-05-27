import type { SalesDecisionGuards } from "../types";
import type { ProspectAnalysis, SalesStrategy } from "@/lib/ai/sales/types";

/** Interdit forcing, spam commercial, pression excessive, répétitions vente. */
export function applyAntiAggressiveGuard(args: {
  analysis: ProspectAnalysis;
  proposedStrategy: SalesStrategy;
  recentSalesPushCount?: number;
  message: string;
  blockAggressiveClose?: boolean;
}): { strategy: SalesStrategy; guards: SalesDecisionGuards } {
  const reasons: string[] = [];
  let strategy = args.proposedStrategy;
  let blockHardClose = false;
  let blockUpsell = false;
  let softenTone = false;

  const m = String(args.message ?? "").toLowerCase();
  const refuses =
    /\b(non merci|pas maintenant|plus tard|stop|laisse|arrête|arrete|spam|trop de messages)\b/i.test(m) ||
    args.analysis.emotion === "Frustrated";

  if (refuses) {
    blockHardClose = true;
    blockUpsell = true;
    softenTone = true;
    reasons.push("prospect_refusal_or_frustration");
    if (strategy === "DIRECT_CLOSE" || strategy === "UPSELL") strategy = "TRUST_BUILDING";
    if (strategy === "SOFT_CLOSE") strategy = "SOFT_CONVERSATION";
  }

  if (args.analysis.conversationFatigue > 0.55) {
    softenTone = true;
    reasons.push("conversation_fatigue");
    if (strategy === "DIRECT_CLOSE") strategy = "SOFT_CLOSE";
    if (strategy === "UPSELL") blockUpsell = true;
  }

  const pushes = Math.max(0, args.recentSalesPushCount ?? 0);
  if (pushes >= 2) {
    blockHardClose = true;
    blockUpsell = true;
    reasons.push("recent_sales_push_cap");
    if (strategy === "DIRECT_CLOSE" || strategy === "UPSELL") strategy = "SOFT_CONVERSATION";
  }

  if (args.analysis.trust === "Low" && strategy === "DIRECT_CLOSE") {
    blockHardClose = true;
    strategy = "TRUST_BUILDING";
    reasons.push("low_trust_no_hard_close");
  }

  if (args.blockAggressiveClose) {
    blockHardClose = true;
    blockUpsell = true;
    reasons.push("emotional_block_aggressive_close");
    if (strategy === "DIRECT_CLOSE" || strategy === "UPSELL") strategy = "TRUST_BUILDING";
    if (strategy === "SOFT_CLOSE") strategy = "SOFT_CONVERSATION";
  }

  if (args.analysis.emotion === "Joking" && (strategy === "DIRECT_CLOSE" || strategy === "OBJECTION_HANDLING")) {
    strategy = "SOFT_CONVERSATION";
    softenTone = true;
    reasons.push("joking_tone_soften");
  }

  return {
    strategy,
    guards: { blockHardClose, blockUpsell, softenTone, reasons },
  };
}
