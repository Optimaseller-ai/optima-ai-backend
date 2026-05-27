import "server-only";

import {
  computeAbandonmentRisk,
  computeRelationalQuality,
} from "./confidence-scoring-engine";
import { buildProspectEmotionalState } from "./emotional-state-manager";
import { buildEmpatheticResponseHints } from "./empathetic-response-engine";
import { planFrustrationRecovery } from "./frustration-recovery-engine";
import type {
  EmotionalIntelligenceInput,
  EmotionalIntelligenceOutput,
  EmotionalSupervisorInsights,
  SalesEmotionalAdaptation,
} from "./types";

function deriveSalesAdaptation(state: ReturnType<typeof buildProspectEmotionalState>): SalesEmotionalAdaptation {
  const recovery = planFrustrationRecovery(state, "fr");
  if (recovery) return recovery.adaptation;

  const blockAggressiveClose = state.frustrationLevel > 0.45 || state.trustLevel < 0.38;
  const accelerateConversion =
    (state.dominantEmotion === "enthusiasm" || state.dominantEmotion === "excitement" || state.dominantEmotion === "confidence") &&
    state.buyingConfidence > 0.65;
  const increaseReassurance =
    state.dominantEmotion === "scam_fear" || state.trustLevel < 0.45 || state.dominantEmotion === "hesitation";
  const slowDownPace = state.frustrationLevel > 0.35 || state.patienceLevel < 0.4;

  const reasoning = [
    blockAggressiveClose ? "close_adouci" : "",
    accelerateConversion ? "conversion_acceleree" : "",
    increaseReassurance ? "reassurance_renforcee" : "",
    slowDownPace ? "rythme_ralenti" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    blockAggressiveClose,
    accelerateConversion,
    increaseReassurance,
    slowDownPace,
    reasoning: reasoning || "Équilibre émotionnel standard.",
  };
}

function buildSupervisorInsights(state: ReturnType<typeof buildProspectEmotionalState>): EmotionalSupervisorInsights {
  const trustBand = state.trustLevel < 0.38 ? "low" : state.trustLevel > 0.68 ? "high" : "medium";
  return {
    dominantEmotion: state.dominantEmotion,
    trustBand,
    trustLevel01: Math.round(state.trustLevel * 100) / 100,
    abandonmentRisk: computeAbandonmentRisk({
      frustrationLevel: state.frustrationLevel,
      trust01: state.trustLevel,
      buyingConfidence: state.buyingConfidence,
      patienceLevel: state.patienceLevel,
    }),
    relationalQuality: computeRelationalQuality({
      trust01: state.trustLevel,
      conversationComfort: state.conversationComfort,
      frustrationLevel: state.frustrationLevel,
    }),
    conversationEmotionalState: describeEmotionalState(state),
    buyingConfidence01: Math.round(state.buyingConfidence * 100) / 100,
    frustrationLevel01: Math.round(state.frustrationLevel * 100) / 100,
  };
}

function describeEmotionalState(state: ReturnType<typeof buildProspectEmotionalState>): string {
  const momentum =
    state.emotionalMomentum === 1 ? "tendance positive" : state.emotionalMomentum === -1 ? "tendance négative" : "stable";
  return `${state.dominantEmotion} · confort ${Math.round(state.conversationComfort * 100)}% · ${momentum}`;
}

/**
 * Moteur principal — intelligence émotionnelle avancée pour agents Seller AI.
 */
export function runEmotionalIntelligenceEngine(input: EmotionalIntelligenceInput): EmotionalIntelligenceOutput {
  const lang = input.lang ?? "fr";
  const state = buildProspectEmotionalState(input);
  const adaptation = deriveSalesAdaptation(state);
  const empathy = buildEmpatheticResponseHints(state, lang);
  const recovery = planFrustrationRecovery(state, lang);

  if (recovery) {
    Object.assign(adaptation, recovery.adaptation);
  }

  return {
    state,
    adaptation,
    supervisor: buildSupervisorInsights(state),
    empatheticGuidanceFr: [...empathy.guidanceFr, ...(recovery?.recoveryStepsFr ?? [])],
    empatheticGuidanceEn: [...empathy.guidanceEn, ...(recovery?.recoveryStepsEn ?? [])],
    antiRoboticRules: [...empathy.antiRoboticRules, ...(recovery?.forbiddenActions ?? [])],
  };
}
