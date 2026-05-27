import type { PriorityDecision } from "../decision-engine/decision-priority-engine";
import type { SmartSilenceDecision } from "../timing/smart-silence-engine";
import type { ConversationGoal, ConversationStage, OrchestratorActionKind, ProspectTemperature } from "../types";

export type ActionSelectionInput = {
  priority: PriorityDecision;
  silence: SmartSilenceDecision;
  stage: ConversationStage;
  goal: ConversationGoal;
  temperature: ProspectTemperature;
  needsAdminApproval: boolean;
  hasScheduledFollowup: boolean;
};

export function selectOrchestratorAction(input: ActionSelectionInput): {
  action: OrchestratorActionKind;
  reason: string;
  confidence: number;
} {
  if (input.silence.shouldPause) {
    return {
      action: "hold_silence",
      reason: input.silence.reason,
      confidence: 0.85,
    };
  }

  if (input.needsAdminApproval) {
    return {
      action: "request_admin_approval",
      reason: "Action sensible — validation superviseur requise.",
      confidence: 0.9,
    };
  }

  if (input.goal === "schedule_followup" && !input.hasScheduledFollowup) {
    return {
      action: "schedule_followup",
      reason: "Prospect froid ou silence prolongé — relance programmée.",
      confidence: 0.75,
    };
  }

  if (input.priority.accelerateClose && input.temperature === "ready") {
    return {
      action: "reply_now",
      reason: "Closing — réponse immédiate orientée conclusion.",
      confidence: 0.88,
    };
  }

  if (input.goal === "recommend_product" && input.stage === "recommendation") {
    return {
      action: "recommend_product",
      reason: "Besoin produit identifié — recommandation ciblée.",
      confidence: 0.8,
    };
  }

  if (input.priority.reassureBeforeSell) {
    return {
      action: "reply_now",
      reason: "Réponse rassurante avant toute proposition.",
      confidence: 0.82,
    };
  }

  return {
    action: "reply_now",
    reason: "Tour standard — réponse humaine maintenant.",
    confidence: 0.7,
  };
}
