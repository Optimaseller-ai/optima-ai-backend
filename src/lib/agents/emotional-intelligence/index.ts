export { runEmotionalIntelligenceEngine } from "./emotional-intelligence-engine";
export { formatEmotionalIntelligencePromptBlock } from "./emotional-prompt-block";
export { detectEmotionalSignals, pickDominantEmotion } from "./emotion-detection-engine";
export { buildProspectEmotionalState } from "./emotional-state-manager";
export { computeTrustLevel } from "./trust-engine";
export { planFrustrationRecovery } from "./frustration-recovery-engine";
export { buildEmpatheticResponseHints } from "./empathetic-response-engine";
export { computeAbandonmentRisk, computeBuyingConfidence, computeRelationalQuality } from "./confidence-scoring-engine";
export { formatEmotionalSupervisorSummary } from "./supervisor-insights";
export { enrichSalesInsightWithEmotional } from "./merge-sales-insight";
export type {
  DominantEmotion,
  EmotionalIntelligenceInput,
  EmotionalIntelligenceOutput,
  EmotionalSupervisorInsights,
  EmotionalTrustBand,
  ProspectEmotionalState,
  SalesEmotionalAdaptation,
} from "./types";
