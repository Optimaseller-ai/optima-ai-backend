import type { ProspectEmotionalState, SalesEmotionalAdaptation } from "./types";

export type FrustrationRecoveryPlan = {
  adaptation: SalesEmotionalAdaptation;
  recoveryStepsFr: string[];
  recoveryStepsEn: string[];
  forbiddenActions: string[];
};

/** Quand frustration élevée — ralentir, rassurer, pas de vente agressive. */
export function planFrustrationRecovery(state: ProspectEmotionalState, lang: "fr" | "en" | "es"): FrustrationRecoveryPlan | null {
  if (state.frustrationLevel < 0.5 && state.dominantEmotion !== "frustration" && state.dominantEmotion !== "mild_anger") {
    return null;
  }

  const adaptation: SalesEmotionalAdaptation = {
    blockAggressiveClose: true,
    accelerateConversion: false,
    increaseReassurance: true,
    slowDownPace: true,
    reasoning: "Frustration détectée — reconstruction confiance, pas de forcing commercial.",
  };

  const recoveryStepsFr = [
    "Reconnaître le ressenti en une phrase courte (pas corporate).",
    "Proposer un fait vérifiable ou une action concrète sous votre contrôle.",
    "Revenir à un ton conversationnel — une question utile max.",
  ];
  const recoveryStepsEn = [
    "Acknowledge feeling in one short non-corporate line.",
    "Offer one verifiable fact or concrete action you control.",
    "Return to natural chat — at most one useful question.",
  ];

  const forbiddenActions =
    lang === "en"
      ? ["Hard close", "Upsell stack", "Repeated apologies", "“How may I help you”"]
      : ["Close agressif", "Empiler l’upsell", "Excuses répétées", "« Comment puis-je vous aider »"];

  return { adaptation, recoveryStepsFr, recoveryStepsEn, forbiddenActions };
}
