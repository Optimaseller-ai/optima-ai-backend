export { runSalesDecisionEngine, toSalesInsightSnapshot } from "./sales-decision-engine";
export { formatSalesDecisionPromptBlock } from "./decision-prompt-block";
export { analyzeProspectState } from "./prospect-analysis/prospect-analyzer";
export { analyzeProspectSilence } from "./prospect-analysis/silence-analyzer";
export { detectBrainObjections, primaryBrainObjection } from "./objection-handling/objection-detector";
export { buildObjectionResponseHints } from "./objection-handling/objection-responses";
export { deriveClosingStrategy } from "./closing/closing-strategy-engine";
export { deriveUpsellRecommendation } from "./upsell/upsell-recommendation-engine";
export { deriveFollowupStrategy } from "./followup-strategy/followup-strategy-engine";
export { selectSalesStrategy, shouldEscalateToHuman } from "./decision-engine/strategy-selector";
export { applyAntiAggressiveGuard } from "./decision-engine/anti-aggressive-guard";
export type {
  SalesDecisionInput,
  SalesDecisionOutput,
  SalesDecisionGuards,
  ClosingLevel,
  ObjectionResponseHint,
  UpsellRecommendation,
} from "./types";
export type {
  LeadTemperature,
  ObjectionType,
  ProspectAnalysis,
  ProspectEmotion,
  PurchaseIntention,
  SalesStrategy,
  SupervisorInsights,
  TrustLevel,
} from "./types";
