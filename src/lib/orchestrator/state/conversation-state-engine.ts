import { detectProspectTurnIntent } from "@/lib/agents/human-behavior/response-orchestrator";
import { detectProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";
import { buildLiveSalesIntelligenceSnapshot } from "@/lib/agents/sales-intelligence/live-sales-intelligence-engine";
import type { SellerBehaviorConversationState, SellerIntent } from "@/lib/agents/memory/conversation-state";
import { inferConversationStage, inferProspectTemperature } from "../goals/conversation-stages";
import { resolveConversationGoal } from "../goals/goal-engine";
import type {
  ConversationGoal,
  ConversationLiveState,
  ConversationStage,
  OrchestratorActionKind,
  PendingOrchestratorAction,
  ProspectTemperature,
} from "../types";
import type { ProspectTurnIntent } from "@/lib/agents/human-behavior/response-orchestrator";
import type { ProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";

export function deriveOrchestratorSignals(args: {
  message: string;
  conversationState?: SellerBehaviorConversationState;
}): {
  intent: ProspectTurnIntent;
  emotion: ProspectEmotion;
  temperature: ProspectTemperature;
  stage: ConversationStage;
  goal: ConversationGoal;
} {
  const intent = detectProspectTurnIntent(args.message);
  const emotion = detectProspectEmotion(args.message);
  const profile = args.conversationState?.conversationProfile;
  const turnCount = args.conversationState?.stats?.turn_count ?? 0;
  const temperature = inferProspectTemperature({ conversationProfile: profile, intent, emotion });
  const stage = inferConversationStage({
    intent,
    temperature,
    turnCount,
    emotion,
    hadPurchaseSignal: intent === "achat" || emotion === "purchase_interest",
  });
  const lead = args.conversationState?.prospectLead;
  const hasContact = Boolean(lead?.phone?.trim() || lead?.email?.trim());
  const goal = resolveConversationGoal({ stage, intent, temperature, emotion, hasContactInfo: hasContact });
  return { intent, emotion, temperature, stage, goal };
}

export function buildConversationLiveState(args: {
  message: string;
  conversationState?: SellerBehaviorConversationState;
  previous?: ConversationLiveState | null;
  selectedAction: OrchestratorActionKind;
  pendingActions: PendingOrchestratorAction[];
  priorityMode: string;
  confidenceScore: number;
  activeSalesOpportunity: boolean;
  nextFollowupAt?: string | null;
  workflowTrigger?: string | null;
}): ConversationLiveState {
  const { intent, emotion, temperature, stage, goal } = deriveOrchestratorSignals({
    message: args.message,
    conversationState: args.conversationState,
  });

  return {
    updatedAt: new Date().toISOString(),
    currentGoal: goal,
    prospectTemperature: temperature,
    conversationStage: stage,
    pendingActions: args.pendingActions,
    awaitingReply: args.selectedAction === "wait" || args.selectedAction === "hold_silence",
    lastAgentAction: args.selectedAction,
    lastProspectIntent: intent,
    activeSalesOpportunity: args.activeSalesOpportunity,
    emotionalState: emotion,
    urgencyLevel:
      temperature === "ready" || temperature === "hot" ? "high" : temperature === "warm" ? "medium" : "low",
    confidenceScore: args.confidenceScore,
    priorityMode: args.priorityMode,
    nextFollowupAt: args.nextFollowupAt ?? args.previous?.nextFollowupAt ?? null,
    lastWorkflowTrigger: args.workflowTrigger ?? args.previous?.lastWorkflowTrigger ?? null,
  };
}

export function detectActiveSalesOpportunity(args: {
  message: string;
  sellerIntent?: SellerIntent;
  conversationState?: SellerBehaviorConversationState;
}): boolean {
  const intel = buildLiveSalesIntelligenceSnapshot({
    message: args.message,
    sellerIntent: args.sellerIntent ?? "other",
    conversationProfile: args.conversationState?.conversationProfile,
    stats: args.conversationState?.stats,
    salesSignalsMemory: args.conversationState?.salesSignalsMemory,
  });
  return (
    intel.buying.intentScore >= 55 ||
    intel.temperature.temperature === "hot" ||
    intel.temperature.temperature === "warm"
  );
}
