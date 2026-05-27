/**
 * Types centraux — Live Conversation Orchestrator.
 */

import type { ProspectTurnIntent } from "@/lib/agents/human-behavior/response-orchestrator";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import type { ProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";

export type ConversationStage =
  | "greeting"
  | "discovery"
  | "recommendation"
  | "objection_handling"
  | "negotiation"
  | "closing"
  | "followup"
  | "post_sale";

export type ConversationGoal =
  | "learn_need"
  | "recommend_product"
  | "reassure"
  | "capture_email"
  | "capture_phone"
  | "finalize_order"
  | "trigger_payment"
  | "schedule_followup"
  | "maintain_relationship"
  | "resolve_complaint";

export type ProspectTemperature = "cold" | "warm" | "hot" | "ready";

export type OrchestratorActionKind =
  | "reply_now"
  | "wait"
  | "multi_message"
  | "recommend_product"
  | "schedule_followup"
  | "trigger_n8n"
  | "request_admin_approval"
  | "send_email"
  | "schedule_future_task"
  | "hold_silence";

export type UrgencyLevel = "low" | "medium" | "high";

export type PendingOrchestratorAction = {
  kind: OrchestratorActionKind;
  scheduledFor?: string;
  reason: string;
  confidence: number;
};

export type ConversationLiveState = {
  updatedAt: string;
  currentGoal: ConversationGoal;
  prospectTemperature: ProspectTemperature;
  conversationStage: ConversationStage;
  pendingActions: PendingOrchestratorAction[];
  awaitingReply: boolean;
  lastAgentAction?: OrchestratorActionKind;
  lastProspectIntent: ProspectTurnIntent;
  activeSalesOpportunity: boolean;
  emotionalState: ProspectEmotion;
  urgencyLevel: UrgencyLevel;
  confidenceScore: number;
  priorityMode?: string;
  nextFollowupAt?: string | null;
  lastWorkflowTrigger?: string | null;
};

export type TimelineEventKind =
  | "seen"
  | "typing"
  | "reply"
  | "silence"
  | "followup_scheduled"
  | "email_queued"
  | "workflow"
  | "approval_requested"
  | "safety_block";

export type TimelineEvent = {
  at: string;
  kind: TimelineEventKind;
  label: string;
  meta?: Record<string, string | number | boolean>;
};

export type OrchestratorSupervisionSnapshot = {
  currentGoal: ConversationGoal;
  conversationStage: ConversationStage;
  prospectTemperature: ProspectTemperature;
  emotionalState: ProspectEmotion;
  urgencyLevel: UrgencyLevel;
  nextPlannedAction: OrchestratorActionKind;
  nextPlannedActionReason: string;
  scheduledFollowupAt?: string | null;
  workflowTriggered?: string | null;
  confidenceScore: number;
  priorityMode?: string;
  safetyFlags: string[];
  timelinePreview: TimelineEvent[];
};

export type LiveOrchestratorInput = {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  conversationState?: SellerBehaviorConversationState;
  userId: string;
  sessionId?: string;
  agentId?: string;
  lang?: "fr" | "en" | "es";
  businessName?: string;
  previousLiveState?: ConversationLiveState | null;
};

export type LiveOrchestratorResult = {
  liveState: ConversationLiveState;
  selectedAction: OrchestratorActionKind;
  supervision: OrchestratorSupervisionSnapshot;
  promptGuidanceBlock: string;
  timeline: TimelineEvent[];
  shouldDeferReply: boolean;
  deferReplyMs?: number;
  rhythmHints: string[];
  safetyBlocked: boolean;
  safetyReasons: string[];
};
