import "server-only";

import { analyzeBuyingIntent, type BuyingIntentSnapshot } from "./intent-analysis/buying-intent-engine";
import { inferSalesTemperature, type SalesTemperatureSnapshot } from "./sales-scoring/sales-temperature";
import { detectSalesObjections, type ObjectionHit } from "./objections/objection-detector";
import { buildConversationGuidance, type ConversationGuidance } from "./conversation-guidance/conversation-guidance";
import { assessConversationFatigue, type ConversationFatigueSnapshot } from "./conversation-guidance/conversation-fatigue";
import { deriveSmartProductRecommendations, type RecommendationHint } from "./cross-sell/smart-product-recommendations";
import { inferUpsellFraming, type UpsellFramingSnapshot } from "./upsell/upsell-framing";
import { inferSoftUrgency, type SoftUrgencySnapshot } from "./urgency/soft-urgency-engine";
import { deriveClosingCue, type ClosingSnapshot } from "./closing/closing-engine";
import type {
  ConversationProfile,
  SalesSignalsMemory,
  SellerIntent,
} from "@/lib/agents/memory/conversation-state";

export type LiveSalesIntelligenceSnapshot = {
  buying: BuyingIntentSnapshot;
  objections: ObjectionHit[];
  temperature: SalesTemperatureSnapshot;
  guidance: ConversationGuidance;
  fatigue: ConversationFatigueSnapshot;
  urgency: SoftUrgencySnapshot;
  closing: ClosingSnapshot;
  recos: RecommendationHint[];
  upsell: UpsellFramingSnapshot;
  salesMemory?: SalesSignalsMemory;
};

export function buildLiveSalesIntelligenceSnapshot(args: {
  message: string;
  sellerIntent: SellerIntent;
  conversationProfile?: ConversationProfile;
  stats?: { turn_count?: number; fatigue?: number };
  salesSignalsMemory?: SalesSignalsMemory;
}): LiveSalesIntelligenceSnapshot {
  const buying = analyzeBuyingIntent(args.message, args.sellerIntent);
  const objections = detectSalesObjections(args.message);
  const turns = typeof args.stats?.turn_count === "number" ? args.stats!.turn_count! : 0;
  const temperature = inferSalesTemperature({
    buyingPhase: buying.phase,
    intentScore: buying.intentScore,
    conversationProfile: args.conversationProfile,
    turnCount: turns,
  });
  const guidance = buildConversationGuidance({ buyingPhase: buying.phase, objectionHits: objections });
  const fatigue = assessConversationFatigue({
    turnCount: turns,
    behavioralFatigue01: typeof args.stats?.fatigue === "number" ? args.stats!.fatigue : 0,
  });

  const lastScore = typeof args.salesSignalsMemory?.lastIntentScore === "number" ? args.salesSignalsMemory!.lastIntentScore! : 0;
  const shortReplyStreakRisk = fatigue.fatigueScore01 > 0.55 || (buying.intentScore < 40 && lastScore < 42);

  const urgency = inferSoftUrgency({
    temperature: temperature.temperature,
    buyingScore: Math.max(buying.intentScore, args.conversationProfile?.buyingIntent ?? 0),
    shortReplyStreakRisk,
    recentStrongPush: false,
  });

  const closing = deriveClosingCue({
    temperature: temperature.temperature,
    buyingPhase: buying.phase,
    closingIntensityHint: temperature.closingIntensityHint,
    fatigueShorten: fatigue.shortenReplies,
  });

  const recos = deriveSmartProductRecommendations(args.message);
  const upsell = inferUpsellFraming(args.message);

  return {
    buying,
    objections,
    temperature,
    guidance,
    fatigue,
    urgency,
    closing,
    recos,
    upsell,
    salesMemory: args.salesSignalsMemory,
  };
}
