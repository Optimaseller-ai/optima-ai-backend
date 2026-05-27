import type { ProspectTurnIntent } from "@/lib/agents/human-behavior/response-orchestrator";
import type { ProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";
import type { ConversationGoal, ConversationStage, ProspectTemperature, UrgencyLevel } from "../types";

export type PriorityDecision = {
  mode: string;
  urgency: UrgencyLevel;
  reassureBeforeSell: boolean;
  accelerateClose: boolean;
  suppressSalesPush: boolean;
  reasons: string[];
};

export function evaluateDecisionPriority(args: {
  intent: ProspectTurnIntent;
  emotion: ProspectEmotion;
  temperature: ProspectTemperature;
  stage: ConversationStage;
  goal: ConversationGoal;
  lowStockOnFocus: boolean;
}): PriorityDecision {
  const reasons: string[] = [];
  let reassureBeforeSell = false;
  let accelerateClose = false;
  let suppressSalesPush = false;
  let urgency: UrgencyLevel = "medium";
  let mode = "balanced_commercial";

  const frustrated = args.emotion === "frustration" || args.emotion === "anger";
  const ready = args.temperature === "ready" || args.intent === "achat";

  if (frustrated && ready) {
    reassureBeforeSell = true;
    mode = "reassure_then_close";
    reasons.push("Prospect frustré mais prêt à acheter — rassurer avant de conclure.");
    urgency = "high";
  } else if (frustrated) {
    reassureBeforeSell = true;
    suppressSalesPush = true;
    mode = "reassure_only";
    reasons.push("Prospect frustré — pas de push commercial.");
    urgency = "medium";
  } else if (args.temperature === "hot" && args.lowStockOnFocus) {
    accelerateClose = true;
    mode = "closing_low_stock";
    reasons.push("Prospect chaud + stock faible — closing sobre et rapide.");
    urgency = "high";
  } else if (ready) {
    accelerateClose = true;
    mode = "closing";
    reasons.push("Signal d'achat — guider vers conclusion.");
    urgency = "high";
  } else if (args.emotion === "hesitation" || args.intent === "objection") {
    reassureBeforeSell = true;
    mode = "objection_care";
    reasons.push("Objection / hésitation — rassurer d'abord.");
    urgency = "medium";
  } else if (args.temperature === "cold") {
    suppressSalesPush = true;
    mode = "nurture";
    reasons.push("Prospect froid — écoute et découverte.");
    urgency = "low";
  }

  return {
    mode,
    urgency,
    reassureBeforeSell,
    accelerateClose,
    suppressSalesPush,
    reasons,
  };
}
