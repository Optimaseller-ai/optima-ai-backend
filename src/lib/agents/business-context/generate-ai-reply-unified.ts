import "server-only";

import type { GenerateAIReplyResult } from "@/lib/agents/business-context/reply";
import { generateAIReply } from "@/lib/agents/business-context/reply";
import { postOptimaAiBackend } from "@/lib/ai/openrouter-backend-client";
import { isRailwayFullOrchestratorEnabled } from "@/lib/ai/openrouter-proxy-config";
import {
  buildRailwayChatReplyPayload,
  describeRailwayPayloadForLog,
  safeJsonStringifyForLog,
  type GenerateAIReplyRailwayMeta,
} from "@/lib/ai/railway-chat-reply-payload";

export type { GenerateAIReplyRailwayMeta };

export type GenerateAIReplyUnifiedArgs = Parameters<typeof generateAIReply>[0] & {
  railwayMeta?: GenerateAIReplyRailwayMeta;
};

function mapRailwayResponse(
  j: Record<string, unknown>,
): GenerateAIReplyResult & { orchestratorPipelineDebug?: Record<string, unknown> } {
  const payload = (j.payload && typeof j.payload === "object" ? j.payload : {}) as Record<string, unknown>;
  const reply =
    typeof payload.reply === "string" ? payload.reply : typeof j.reply === "string" ? j.reply : "";

  const orchestratorPipelineDebug =
    j.orchestrator_pipeline_debug && typeof j.orchestrator_pipeline_debug === "object"
      ? (j.orchestrator_pipeline_debug as Record<string, unknown>)
      : undefined;

  return {
    reply,
    socialOnlyMode: payload.socialOnlyMode as GenerateAIReplyResult["socialOnlyMode"],
    replyTransformationChain: payload.replyTransformationChain as GenerateAIReplyResult["replyTransformationChain"],
    supervisorInsights: payload.supervisorInsights as GenerateAIReplyResult["supervisorInsights"],
    emotionalSupervisorInsights: payload.emotionalSupervisorInsights as GenerateAIReplyResult["emotionalSupervisorInsights"],
    personalitySupervisorInsights: payload.personalitySupervisorInsights as GenerateAIReplyResult["personalitySupervisorInsights"],
    socialSupervisorInsights: payload.socialSupervisorInsights as GenerateAIReplyResult["socialSupervisorInsights"],
    replyOwnership: payload.replyOwnership as GenerateAIReplyResult["replyOwnership"],
    liveOrchestrator: payload.liveOrchestrator as GenerateAIReplyResult["liveOrchestrator"],
    orchestratorPipelineDebug,
  };
}

/**
 * Runs `generateAIReply` locally, or delegates the full orchestration brain to Railway
 * when `OPTIMA_AI_BACKEND_URL` + secret are set and `OPTIMA_RAILWAY_FULL_ORCHESTRATOR` is not disabled.
 */
export async function generateAIReplyUnified(
  args: GenerateAIReplyUnifiedArgs,
): Promise<GenerateAIReplyResult & { orchestratorPipelineDebug?: Record<string, unknown> }> {
  const { railwayMeta, ...localArgs } = args;

  if (isRailwayFullOrchestratorEnabled()) {
    if (!railwayMeta) {
      throw new Error("[OPTIMA_REPLY_PIPELINE] railway_full_orchestrator_enabled_missing_railwayMeta");
    }

    const railwayPayload = buildRailwayChatReplyPayload({
      railwayMeta,
      message: localArgs.message,
      userId: localArgs.userId,
      agentId: localArgs.agentId,
      agentName: localArgs.agentName,
      agentPersonality: localArgs.agentPersonality,
      salesStyle: localArgs.salesStyle,
      businessName: localArgs.businessName,
      conversationState: localArgs.conversationState,
      history: localArgs.history,
      agentRole: localArgs.agentRole,
      agentTone: localArgs.agentTone,
      personaKey: localArgs.personaKey ?? null,
      followupAfterHold: localArgs.followupAfterHold,
    });

    console.log("[OPTIMA_REPLY_PIPELINE] delegating_to_railway", describeRailwayPayloadForLog(railwayPayload));
    console.log("[OPTIMA_REPLY_PIPELINE] outgoing_body_json", safeJsonStringifyForLog(railwayPayload));

    try {
      const data = await postOptimaAiBackend<Record<string, unknown>>("/v1/chat/reply", railwayPayload);
      return mapRailwayResponse(data);
    } catch (e) {
      const err = e as Error & { status?: number; validationIssues?: unknown };
      const em = String(err.message ?? "");
      if (err.status === 409 && (em.includes("duplicate") || em === "duplicate_request")) {
        throw new Error("RAILWAY_DUPLICATE_REPLY_REQUEST");
      }
      if (err.status === 409 && (em.includes("stale") || em === "stale_reply_turn")) {
        throw new Error("RAILWAY_STALE_REPLY_TURN");
      }
      if (err.status === 400) {
        console.error("[OPTIMA_REPLY_PIPELINE] railway_invalid_body", {
          message: em,
          issues: err.validationIssues,
        });
      }
      throw e;
    }
  }

  return generateAIReply(localArgs);
}
