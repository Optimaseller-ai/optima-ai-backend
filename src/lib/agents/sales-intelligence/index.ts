import "server-only";

export { analyzeBuyingIntent, type BuyingIntentPhase, type BuyingIntentSnapshot } from "./intent-analysis/buying-intent-engine";
export { inferSalesTemperature, type SalesTemperature, type SalesTemperatureSnapshot } from "./sales-scoring/sales-temperature";
export { mergeSalesSignalsMemory } from "./sales-scoring/sales-signals-memory";
export {
  detectSalesObjections,
  primaryObjection,
  type ObjectionKind,
  type ObjectionHit,
} from "./objections/objection-detector";
export { formatHumanReassuranceGuidance } from "./objections/human-reassurance";
export { buildConversationGuidance, type ConversationGuidance } from "./conversation-guidance/conversation-guidance";
export { assessConversationFatigue, type ConversationFatigueSnapshot } from "./conversation-guidance/conversation-fatigue";
export { deriveSmartProductRecommendations, type RecommendationHint } from "./cross-sell/smart-product-recommendations";
export { inferUpsellFraming, type UpsellFramingSnapshot } from "./upsell/upsell-framing";
export { inferSoftUrgency, type SoftUrgencySnapshot, type SoftUrgencyLevel } from "./urgency/soft-urgency-engine";
export { deriveClosingCue, type ClosingSnapshot, type ClosingStrength } from "./closing/closing-engine";
export { formatAntiRobotSalesSystemBlock } from "./anti-robot-sales";
export {
  buildLiveSalesIntelligenceSnapshot,
  type LiveSalesIntelligenceSnapshot,
} from "./live-sales-intelligence-engine";
export { formatLiveSalesIntelligencePromptBlock } from "./intelligence-prompt-block";
