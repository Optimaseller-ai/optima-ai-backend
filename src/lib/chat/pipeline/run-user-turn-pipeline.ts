import "server-only";

import type { SellerBehaviorConversationState, SellerIntent } from "@/lib/agents/memory/conversation-state";
import { mergeSellerBehaviorStateForUserTurn } from "@/lib/agents/memory/merge-conversation-state";
import type { ConversationPipelineDebugger } from "./conversation-pipeline-debugger";
import { mergeSocialOnlyIntoConversationState } from "./social-only-mode";
import { resolveConversationRouting } from "@/lib/agents/social/business-conversation-router";
import { resolveSocialOnlyHardLock } from "./social-only-hard-lock";
import { safeEngineExecuteSync } from "./safe-engine-executor";

export type UserTurnPipelineResult = {
  state: SellerBehaviorConversationState;
  intent: SellerIntent;
  degraded: boolean;
};

/**
 * Tour utilisateur — ordre validé : social + emotion + memory (via merge central).
 * Dégradation : état précédent conservé si merge crash.
 */
export function runUserTurnPipeline(args: {
  previous: unknown;
  message: string;
  recentChat?: Array<{ role: "user" | "assistant"; content: string }>;
  personaKey?: string | null;
  debugger?: ConversationPipelineDebugger;
}): UserTurnPipelineResult {
  const prev =
    typeof args.previous === "object" && args.previous
      ? ({ ...(args.previous as SellerBehaviorConversationState) } as SellerBehaviorConversationState)
      : ({} as SellerBehaviorConversationState);

  const merge = safeEngineExecuteSync({
    engine: "merge_user_turn",
    step: "memory",
    debugger: args.debugger,
    inputSnapshot: { messageLen: args.message.length, turn: prev.stats?.turn_count },
    fallback: () => ({ state: prev, intent: "other" as SellerIntent }),
    run: () =>
      mergeSellerBehaviorStateForUserTurn({
        previous: prev,
        message: args.message,
        recentChat: args.recentChat,
        personaKey: args.personaKey,
      }),
  });

  if (!merge.result) {
    return { state: prev, intent: "other", degraded: true };
  }

  const routing = resolveConversationRouting({ message: args.message });
  const socialOnly = resolveSocialOnlyHardLock({
    message: args.message,
    conversationState: merge.result.state,
    agentName: args.personaKey ?? undefined,
    personaKey: args.personaKey,
    topics: routing.topics,
  });

  if (socialOnly.active) {
    args.debugger?.setMeta({
      socialSignal: socialOnly.signal,
      selectedStrategy: socialOnly.hardLock ? "social_only_hard_lock" : "social_only",
      fallbackKind: "social",
    });
  }

  return {
    state: mergeSocialOnlyIntoConversationState(merge.result.state, {
      active: socialOnly.active,
      signal: socialOnly.signal,
      pipelineStage: "social",
      leadTemperature: "neutral",
      blockAutomation: socialOnly.hardLock,
      blockSalesEscalation: socialOnly.hardLock,
      blockInterestDetection: socialOnly.hardLock,
      reason: socialOnly.reason,
    }),
    intent: merge.result.intent,
    degraded: !merge.ok,
  };
}
