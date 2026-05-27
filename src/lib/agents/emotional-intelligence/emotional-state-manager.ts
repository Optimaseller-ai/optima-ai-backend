import { detectEmotionalSignals, pickDominantEmotion } from "./emotion-detection-engine";
import { computeBuyingConfidence } from "./confidence-scoring-engine";
import { computeTrustLevel, countSecurityQuestions } from "./trust-engine";
import type { EmotionalIntelligenceInput, ProspectEmotionalState } from "./types";

function frustrationFromEmotion(dominant: ProspectEmotionalState["dominantEmotion"], hits: ReturnType<typeof detectEmotionalSignals>): number {
  const fr = hits.find((h) => h.emotion === "frustration" || h.emotion === "mild_anger");
  if (fr) return fr.weight;
  if (dominant === "frustration" || dominant === "mild_anger") return 0.85;
  if (dominant === "impatience" || dominant === "scam_fear") return 0.45;
  return 0.12;
}

function computeMomentum(
  prev: ProspectEmotionalState | undefined,
  dominant: ProspectEmotionalState["dominantEmotion"],
  buyingConfidence: number,
): -1 | 0 | 1 {
  const negative = ["frustration", "mild_anger", "scam_fear", "confusion"].includes(dominant);
  const positive = ["enthusiasm", "excitement", "confidence", "satisfaction"].includes(dominant);
  if (negative) return -1;
  if (positive && buyingConfidence > 0.55) return 1;
  if (prev && prev.emotionalMomentum === -1 && !negative) return 0;
  return prev?.emotionalMomentum ?? 0;
}

/** Fusionne détection + historique → ProspectEmotionalState. */
export function buildProspectEmotionalState(input: EmotionalIntelligenceInput): ProspectEmotionalState {
  const hits = detectEmotionalSignals(input.message);
  const dominantEmotion = pickDominantEmotion(hits);
  const prev = input.previousState;
  const securityCount =
    (prev?.activeSignals.includes("scam_fear") ? 1 : 0) + countSecurityQuestions(input.message, 0);

  const trust = computeTrustLevel({
    message: input.message,
    dominantEmotion,
    previousTrust01: prev?.trustLevel,
    salesSignalsTrust01: input.salesSignalsTrust01,
    securityQuestionCount: securityCount,
  });

  const scores = computeBuyingConfidence({
    dominantEmotion,
    trust01: trust.trust01,
    message: input.message,
    turnCount: input.turnCount,
  });

  const frustrationLevel = frustrationFromEmotion(dominantEmotion, hits);
  const emotionalMomentum = computeMomentum(prev, dominantEmotion, scores.buyingConfidence);

  return {
    dominantEmotion,
    trustLevel: trust.trust01,
    buyingConfidence: scores.buyingConfidence,
    frustrationLevel,
    conversationComfort: scores.conversationComfort,
    patienceLevel: scores.patienceLevel,
    emotionalMomentum,
    activeSignals: hits.map((h) => h.emotion),
    lastUpdatedAt: Date.now(),
  };
}
