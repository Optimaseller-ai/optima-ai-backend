import "server-only";

import { salesOpportunityAllowedForIntent } from "@/lib/agents/human-behavior/response-orchestrator";
import { buildLiveSalesIntelligenceSnapshot } from "@/lib/agents/sales-intelligence/live-sales-intelligence-engine";
import { selectOrchestratorAction } from "./actions/action-selector";
import { followupToPendingAction, planAutonomousFollowup } from "./actions/autonomous-followup-manager";
import { evaluateDecisionPriority } from "./decision-engine/decision-priority-engine";
import { goalGuidanceLine } from "./goals/goal-engine";
import {
  buildConversationLiveState,
  deriveOrchestratorSignals,
  detectActiveSalesOpportunity,
} from "./state/conversation-state-engine";
import { buildTurnTimeline } from "./state/orchestrator-timeline";
import { evaluateOrchestratorSafety } from "./priorities/safety-layer";
import { evaluateSmartSilence } from "./timing/smart-silence-engine";
import { planHumanRhythm } from "./timing/human-rhythm-orchestrator";
import type {
  LiveOrchestratorInput,
  LiveOrchestratorResult,
  OrchestratorActionKind,
  OrchestratorSupervisionSnapshot,
  TimelineEvent,
} from "./types";

function formatPromptGuidanceBlock(args: {
  lang: "fr" | "en" | "es";
  goalLine: string;
  priorityReasons: string[];
  rhythmHints: string[];
  actionReason: string;
  salesIntelLine?: string;
}): string {
  const header =
    args.lang === "en"
      ? "LIVE ORCHESTRATOR — behave like an autonomous employee (coherent, human):"
      : "ORCHESTRATEUR LIVE — comportement employé autonome (cohérent, humain) :";

  return [
    header,
    args.goalLine,
    `Action: ${args.actionReason}`,
    ...args.priorityReasons.map((r) => `- ${r}`),
    ...args.rhythmHints.map((r) => `- ${r}`),
    args.salesIntelLine,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSupervisionSnapshot(args: {
  liveState: import("./types").ConversationLiveState;
  action: OrchestratorActionKind;
  actionReason: string;
  timeline: TimelineEvent[];
  safetyFlags: string[];
}): OrchestratorSupervisionSnapshot {
  return {
    currentGoal: args.liveState.currentGoal,
    conversationStage: args.liveState.conversationStage,
    prospectTemperature: args.liveState.prospectTemperature,
    emotionalState: args.liveState.emotionalState,
    urgencyLevel: args.liveState.urgencyLevel,
    nextPlannedAction: args.action,
    nextPlannedActionReason: args.actionReason,
    scheduledFollowupAt: args.liveState.nextFollowupAt,
    workflowTriggered: args.liveState.lastWorkflowTrigger,
    confidenceScore: args.liveState.confidenceScore,
    priorityMode: args.liveState.priorityMode,
    safetyFlags: args.safetyFlags,
    timelinePreview: args.timeline.slice(-8),
  };
}

/**
 * Cerveau central temps réel — coordonne signaux sans remplacer les moteurs existants.
 */
export function runLiveConversationOrchestrator(input: LiveOrchestratorInput): LiveOrchestratorResult {
  const lang = input.lang ?? input.conversationState?.language ?? "fr";
  const message = input.message.trim();

  const signals = deriveOrchestratorSignals({
    message,
    conversationState: input.conversationState,
  });

  const salesIntel = buildLiveSalesIntelligenceSnapshot({
    message,
    sellerIntent: input.conversationState?.lastSellerIntent ?? "other",
    conversationProfile: input.conversationState?.conversationProfile,
    stats: input.conversationState?.stats,
    salesSignalsMemory: input.conversationState?.salesSignalsMemory,
  });

  const activeSalesOpportunity =
    detectActiveSalesOpportunity({
      message,
      sellerIntent: input.conversationState?.lastSellerIntent,
      conversationState: input.conversationState,
    }) && salesOpportunityAllowedForIntent(signals.intent);

  const priority = evaluateDecisionPriority({
    intent: signals.intent,
    emotion: signals.emotion,
    temperature: signals.temperature,
    stage: signals.stage,
    goal: signals.goal,
    lowStockOnFocus: false,
  });

  const silence = evaluateSmartSilence({
    message,
    emotion: signals.emotion,
    intent: signals.intent,
  });

  const existingFollowup = input.conversationState?.automation?.nextFollowupAt ?? null;
  const followupPlan = planAutonomousFollowup({
    stage: signals.stage,
    goal: signals.goal,
    temperature: signals.temperature,
    lastActiveAt: input.conversationState?.stats?.last_active_at,
    existingFollowupAt: existingFollowup,
  });
  const pendingActions = followupToPendingAction(followupPlan) ? [followupToPendingAction(followupPlan)!] : [];

  let selection = selectOrchestratorAction({
    priority,
    silence,
    stage: signals.stage,
    goal: signals.goal,
    temperature: signals.temperature,
    needsAdminApproval: false,
    hasScheduledFollowup: Boolean(existingFollowup),
  });

  const safety = evaluateOrchestratorSafety({
    selectedAction: selection.action,
    recentFollowupCount: 0,
    duplicateActionBurst: false,
    automationAggressive: priority.accelerateClose && signals.emotion === "frustration",
  });

  if (!safety.allowed && safety.substituteAction) {
    selection = {
      action: safety.substituteAction,
      reason: `Safety: ${safety.flags.join(", ")}`,
      confidence: 0.65,
    };
  }

  const liveState = buildConversationLiveState({
    message,
    conversationState: input.conversationState,
    previous: input.previousLiveState,
    selectedAction: selection.action,
    pendingActions,
    priorityMode: priority.mode,
    confidenceScore: Math.round(selection.confidence * 100),
    activeSalesOpportunity,
    nextFollowupAt: followupPlan.scheduledFor ?? existingFollowup,
    workflowTrigger: followupPlan.trigger ?? null,
  });

  const rhythm = planHumanRhythm({
    action: selection.action,
    silence,
    replyLengthEstimate: priority.urgency === "high" ? "short" : "medium",
    isHoldReply: false,
  });

  const timeline = buildTurnTimeline({
    action: selection.action,
    followupAt: liveState.nextFollowupAt,
    workflowTrigger: liveState.lastWorkflowTrigger,
    silencePauseMs: silence.pauseMs,
  });

  const salesIntelLine = `Focus vente : ${salesIntel.guidance.headline} · Température : ${salesIntel.temperature.temperature}.`;

  const promptGuidanceBlock = formatPromptGuidanceBlock({
    lang,
    goalLine: goalGuidanceLine(liveState.currentGoal, lang),
    priorityReasons: priority.reasons,
    rhythmHints: rhythm.hints,
    actionReason: selection.reason,
    salesIntelLine,
  });

  const supervision = buildSupervisionSnapshot({
    liveState,
    action: selection.action,
    actionReason: selection.reason,
    timeline,
    safetyFlags: safety.flags,
  });

  return {
    liveState,
    selectedAction: selection.action,
    supervision,
    promptGuidanceBlock,
    timeline,
    shouldDeferReply: silence.shouldPause && selection.action === "hold_silence",
    deferReplyMs: silence.pauseMs,
    rhythmHints: rhythm.hints,
    safetyBlocked: !safety.allowed,
    safetyReasons: safety.flags,
  };
}
