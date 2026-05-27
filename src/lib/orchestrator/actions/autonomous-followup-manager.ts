import type { ConversationGoal, ConversationStage, ProspectTemperature } from "../types";
import type { PendingOrchestratorAction } from "../types";

export type FollowupPlan = {
  shouldSchedule: boolean;
  scheduledFor?: string;
  trigger?: string;
  reason: string;
};

const COLD_FOLLOWUP_MS = 24 * 60 * 60 * 1000;
const WARM_FOLLOWUP_MS = 48 * 60 * 60 * 1000;

export function planAutonomousFollowup(args: {
  stage: ConversationStage;
  goal: ConversationGoal;
  temperature: ProspectTemperature;
  lastActiveAt?: number;
  existingFollowupAt?: string | null;
  abandonedCartHint?: boolean;
  quotePending?: boolean;
}): FollowupPlan {
  if (args.existingFollowupAt) {
    return {
      shouldSchedule: false,
      reason: "Relance déjà programmée.",
    };
  }

  if (args.quotePending) {
    const at = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    return {
      shouldSchedule: true,
      scheduledFor: at,
      trigger: "quotation_followup",
      reason: "Devis en attente — relance J+0,5.",
    };
  }

  if (args.abandonedCartHint) {
    const at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    return {
      shouldSchedule: true,
      scheduledFor: at,
      trigger: "cart_abandoned",
      reason: "Panier / commande abandonnée — relance douce.",
    };
  }

  if (args.goal === "schedule_followup" || (args.temperature === "cold" && args.stage === "followup")) {
    const delay = args.temperature === "cold" ? COLD_FOLLOWUP_MS : WARM_FOLLOWUP_MS;
    const at = new Date(Date.now() + delay).toISOString();
    return {
      shouldSchedule: true,
      scheduledFor: at,
      trigger: "gentle_nurture",
      reason: "Prospect froid — réactivation programmée.",
    };
  }

  return { shouldSchedule: false, reason: "Pas de relance autonome sur ce tour." };
}

export function followupToPendingAction(plan: FollowupPlan): PendingOrchestratorAction | null {
  if (!plan.shouldSchedule || !plan.scheduledFor) return null;
  return {
    kind: "schedule_followup",
    scheduledFor: plan.scheduledFor,
    reason: plan.reason,
    confidence: 0.72,
  };
}
