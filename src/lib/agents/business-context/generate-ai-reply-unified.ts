import "server-only";

import type { GenerateAIReplyResult } from "@/lib/agents/business-context/reply";
import { generateAIReply } from "@/lib/agents/business-context/reply";
import { postOptimaAiBackend } from "@/lib/ai/openrouter-backend-client";
import { isRailwayFullOrchestratorEnabled } from "@/lib/ai/openrouter-proxy-config";
import {
  fromLlmHistory,
  sanitizeConversationHistory,
  toLlmHistory,
  validateConversationHistory,
  computeHistoryQualityScore,
} from "@/lib/chat/pipeline/conversationHistoryManager";
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

function lightlySanitizeBackendReply(text: string): string {
  return String(text ?? "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractRailwayReply(j: Record<string, unknown>): string {
  const payload = (j.payload && typeof j.payload === "object" ? j.payload : {}) as Record<string, unknown>;
  const fromPayload = typeof payload.reply === "string" ? payload.reply : "";
  const fromRoot = typeof j.reply === "string" ? j.reply : "";
  return fromPayload || fromRoot;
}

function pickFinalRailwayReply(rawRailwayReply: string): { reply: string; source: "railway" | "llm" | "sanitized" | "fallback" } {
  const railwayReply = String(rawRailwayReply ?? "").trim();
  const sanitizedReply = lightlySanitizeBackendReply(railwayReply);

  // Priority order (strict):
  // 1) railway_reply 2) llm_generated_reply 3) sanitized_reply 4) fallback only if empty
  if (railwayReply.length > 5) {
    return { reply: railwayReply, source: "railway" };
  }
  if (rawRailwayReply.length > 5) {
    return { reply: rawRailwayReply, source: "llm" };
  }
  if (sanitizedReply.length > 5) {
    return { reply: sanitizedReply, source: "sanitized" };
  }
  return { reply: "", source: "fallback" };
}

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

    const rawHistory = Array.isArray(localArgs.history) ? localArgs.history : [];
    const sanitizedTurns = sanitizeConversationHistory(fromLlmHistory(rawHistory));
    const validatedHistory = toLlmHistory(sanitizedTurns.history);
    validateConversationHistory(sanitizedTurns.history);
    console.log("[HISTORY_BEFORE]", {
      session_id: railwayMeta.session_id,
      request_id: railwayMeta.request_id,
      count: rawHistory.length,
      tail: rawHistory.slice(-6).map((t) => t.role),
    });
    console.log("[HISTORY_AFTER]", {
      session_id: railwayMeta.session_id,
      request_id: railwayMeta.request_id,
      count: validatedHistory.length,
      tail: validatedHistory.slice(-6).map((t) => t.role),
      history_quality_score: computeHistoryQualityScore(sanitizedTurns.history),
    });

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
      history: validatedHistory,
      agentRole: localArgs.agentRole,
      agentTone: localArgs.agentTone,
      personaKey: localArgs.personaKey ?? null,
      followupAfterHold: localArgs.followupAfterHold,
    });

    console.log("[OPTIMA_REPLY_PIPELINE] delegating_to_railway", describeRailwayPayloadForLog(railwayPayload));
    console.log("[OPTIMA_REPLY_PIPELINE] outgoing_body_json", safeJsonStringifyForLog(railwayPayload));

    try {
      const data = await postOptimaAiBackend<Record<string, unknown>>("/v1/chat/reply", railwayPayload);
      const mapped = mapRailwayResponse(data);
      const backendReply = extractRailwayReply(data);
      const sanitizedReply = lightlySanitizeBackendReply(backendReply);
      const picked = pickFinalRailwayReply(backendReply);

      console.log("[POST_PROCESS_BEFORE]", backendReply);
      console.log("[POST_PROCESS_AFTER]", picked.reply || sanitizedReply || backendReply);

      if (picked.source === "railway" && sanitizedReply && sanitizedReply !== backendReply) {
        console.log("[FALLBACK_OVERRIDE_BLOCKED]", {
          reason: "railway_reply_valid_keep_original",
          railwayLen: backendReply.length,
          sanitizedLen: sanitizedReply.length,
        });
      }
      if (picked.source === "fallback") {
        console.log("[FALLBACK_OVERRIDE_BLOCKED]", {
          reason: "fallback_not_allowed_without_empty_reply",
          railwayLen: backendReply.length,
        });
      }
      console.log("[FINAL_REPLY_SOURCE]", {
        source: picked.source,
      });

      return {
        ...mapped,
        reply: picked.reply || mapped.reply || backendReply,
      };
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
