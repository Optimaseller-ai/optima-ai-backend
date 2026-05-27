import "server-only";

import { detectSocialSignal, isSocialSignalKind } from "@/lib/agents/social/social-signal-detector";
import { detectSocialIntent } from "@/lib/agents/human-behavior/social-intent-engine";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type SocialOnlyModeSnapshot = {
  active: boolean;
  signal: string;
  socialIntentKind?: string;
  pipelineStage: "social";
  leadTemperature: "neutral";
  blockAutomation: boolean;
  blockSalesEscalation: boolean;
  blockInterestDetection: boolean;
  reason: string;
};

const CASUAL_ACK = /^(ok|okay|d['’]accord|dac|oui|yes|vale|merci|thanks|👍|🙏)[\s!.?]*$/i;

/**
 * Mode conversation sociale pure — pas de pipeline commercial ni automation.
 */
export function resolveSocialOnlyMode(args: {
  message: string;
  conversationState?: SellerBehaviorConversationState;
  agentName?: string | null;
}): SocialOnlyModeSnapshot {
  const msg = String(args.message ?? "").trim();
  const signal = detectSocialSignal(msg);
  const turn = args.conversationState?.stats?.turn_count ?? 0;
  const intent = detectSocialIntent(msg, {
    agentName: args.agentName,
    turnCount: turn,
    welcomeAlreadyDelivered:
      args.conversationState?.conversationSocialV2?.welcomeDelivered === true || turn >= 2,
  });

  const socialKinds = new Set([
    "simple_greeting",
    "social_chat",
    "personal_question",
    "humor",
    "teasing",
    "curiosity",
  ]);

  const signalSocial = isSocialSignalKind(signal);
  const intentSocial = socialKinds.has(intent.kind);
  const casualOnly = CASUAL_ACK.test(msg);
  const thanksOrNight =
    signal === "thanks" ||
    signal === "farewell_night" ||
    signal === "farewell_day" ||
    signal === "casual_ack" ||
    signal === "hesitation" ||
    signal === "wellbeing_followup" ||
    signal === "question_repeat";

  const active =
    signalSocial ||
    intentSocial ||
    casualOnly ||
    thanksOrNight ||
    (intent.kind === "simple_greeting" && !/\b(prix|commander|acheter|stock|livraison)\b/i.test(msg));

  return {
    active,
    signal: signal !== "none" ? signal : intent.kind,
    socialIntentKind: intent.kind,
    pipelineStage: "social",
    leadTemperature: "neutral",
    blockAutomation: active,
    blockSalesEscalation: active,
    blockInterestDetection: active,
    reason: active
      ? `social_only:${signal !== "none" ? signal : intent.kind}`
      : "commercial_allowed",
  };
}

export function mergeSocialOnlyIntoConversationState(
  state: SellerBehaviorConversationState,
  snapshot: SocialOnlyModeSnapshot,
): SellerBehaviorConversationState {
  if (!snapshot.active) {
    return { ...state, socialOnlyMode: { active: false, reason: snapshot.reason } };
  }

  return {
    ...state,
    socialOnlyMode: {
      active: true,
      signal: snapshot.signal,
      reason: snapshot.reason,
      updatedAt: Date.now(),
    },
    automation: state.automation
      ? {
          ...state.automation,
          pipelineStage: "social",
          leadTemperature: "neutral",
        }
      : { pipelineStage: "social", leadTemperature: "neutral" },
  };
}
