import type { OpenRouterMessage } from "./openrouter-client.js";
import { openRouterChat } from "./openrouter-client.js";
import { acquireReplyLock, releaseReplyLock } from "../../redis/anti-duplicate.js";
import { setTypingState, clearTypingState } from "../../redis/typing-state.js";
import { scheduleTimingJob, type TimingJobKind } from "../../queue/timing-queue.js";
import { generateAIReply } from "@/lib/agents/business-context/reply";
import { beginReplyTurn, isActiveReplyTurn } from "@/lib/chat/pipeline/central-reply-manager";
import { ConversationPipelineDebugger } from "@/lib/chat/pipeline/conversation-pipeline-debugger";
import { jsonSafe } from "@/lib/chat/pipeline/json-safe";

export type FullReplyTimingDelays = {
  read?: number;
  typing?: number;
  followUp?: number;
};

/** JSON body for POST /v1/chat/reply (full seller orchestration). */
export type FullSellerReplyOrchestrationInput = {
  session_id: string;
  request_id: string;
  pipeline_trace_id: string;
  message: string;
  user_id: string;
  agent_name?: string;
  agent_personality?: "chaleureux" | "professionnel" | "dynamique";
  sales_style?: "conseiller" | "closer" | "premium";
  business_name?: string;
  conversation_state?: Record<string, unknown>;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  agent_role?: string;
  agent_tone?: string;
  persona_key?: string | null;
  followup_after_hold?: boolean;
  session_id_for_reply?: string;
  agent_id?: string;
  timing?: FullReplyTimingDelays;
};

export type FullSellerReplyOrchestrationResult = {
  ok: true;
  reply: string;
  request_id: string;
  source: "generate_ai_reply";
  timing_scheduled: TimingJobKind[];
  /** JSON-serialized subset of GenerateAIReplyResult */
  payload: Record<string, unknown>;
  orchestrator_pipeline_debug: Record<string, unknown>;
};

export async function runFullSellerReplyOrchestration(
  input: FullSellerReplyOrchestrationInput,
): Promise<FullSellerReplyOrchestrationResult> {
  const locked = await acquireReplyLock(input.session_id, input.request_id);
  if (!locked) {
    throw new Error("DUPLICATE_REPLY_REQUEST");
  }

  const timingScheduled: TimingJobKind[] = [];

  try {
    await setTypingState(input.session_id, { active: true, requestId: input.request_id });

    if (input.timing?.read) {
      await scheduleTimingJob({
        kind: "read_delay",
        sessionId: input.session_id,
        requestId: input.request_id,
        delayMs: input.timing.read,
      });
      timingScheduled.push("read_delay");
    }

    if (input.timing?.typing) {
      await scheduleTimingJob({
        kind: "typing_delay",
        sessionId: input.session_id,
        requestId: input.request_id,
        delayMs: input.timing.typing,
      });
      timingScheduled.push("typing_delay");
    }

    const replyTurn = beginReplyTurn(input.session_id, input.message, input.request_id);
    const pipelineDebugger = new ConversationPipelineDebugger(input.pipeline_trace_id);

    const memPreview = Array.isArray(input.conversation_state?.memory)
      ? (input.conversation_state?.memory as unknown[]).length
      : 0;
    console.log("[OPTIMA_MEMORY_STATE] inbound", {
      session_id: input.session_id,
      request_id: input.request_id,
      memoryItems: memPreview,
      language: input.conversation_state?.language,
    });

    console.log("[OPTIMA_REPLY_PIPELINE] generateAIReply_start", {
      session_id: input.session_id,
      messageLen: input.message.length,
    });

    const gen = (await generateAIReply({
      message: input.message,
      userId: input.user_id,
      agentName: input.agent_name,
      agentPersonality: input.agent_personality,
      salesStyle: input.sales_style,
      businessName: input.business_name,
      conversationState: input.conversation_state,
      history: input.history,
      agentRole: input.agent_role,
      agentTone: input.agent_tone,
      personaKey: input.persona_key ?? null,
      followupAfterHold: input.followup_after_hold,
      sessionId: input.session_id_for_reply ?? input.session_id,
      agentId: input.agent_id,
      pipelineDebugger,
      replyTurn,
    })) as Record<string, unknown>;

    if (!isActiveReplyTurn(replyTurn)) {
      console.warn("[OPTIMA_RAILWAY_ORCHESTRATOR] stale_reply_turn", {
        session_id: input.session_id,
        request_id: input.request_id,
      });
      throw new Error("STALE_REPLY_TURN");
    }

    const orchestrator_pipeline_debug = pipelineDebugger.toSnapshot();

    const liveRaw = gen.liveOrchestrator;
    const liveSafe = liveRaw ? jsonSafe(liveRaw, {}) : undefined;

    const payload: Record<string, unknown> = {
      reply: gen.reply,
      socialOnlyMode: gen.socialOnlyMode,
      replyTransformationChain: gen.replyTransformationChain,
      supervisorInsights: gen.supervisorInsights,
      emotionalSupervisorInsights: gen.emotionalSupervisorInsights,
      personalitySupervisorInsights: gen.personalitySupervisorInsights,
      socialSupervisorInsights: gen.socialSupervisorInsights,
      replyOwnership: gen.replyOwnership,
      liveOrchestrator: liveSafe,
    };

    if (input.timing?.followUp) {
      await scheduleTimingJob({
        kind: "follow_up_delay",
        sessionId: input.session_id,
        requestId: input.request_id,
        delayMs: input.timing.followUp,
      });
      timingScheduled.push("follow_up_delay");
    }

    console.log("[OPTIMA_REPLY_PIPELINE] generateAIReply_ok", {
      replyLen: typeof gen.reply === "string" ? gen.reply.length : 0,
      request_id: input.request_id,
    });

    return {
      ok: true,
      reply: String(gen.reply ?? ""),
      request_id: input.request_id,
      source: "generate_ai_reply",
      timing_scheduled: timingScheduled,
      payload,
      orchestrator_pipeline_debug,
    };
  } finally {
    await clearTypingState(input.session_id);
    await releaseReplyLock(input.session_id, input.request_id);
  }
}

/** @deprecated Phase 1 thin path — kept for emergency local tools only. */
export async function runReplyOrchestrationPhase1OpenRouter(input: {
  sessionId: string;
  requestId: string;
  message: string;
  messages: OpenRouterMessage[];
  model?: string;
  maxTokens?: number;
  timing?: FullReplyTimingDelays;
}): Promise<{ reply: string; source: "openrouter"; requestId: string; timingScheduled: TimingJobKind[] }> {
  const locked = await acquireReplyLock(input.sessionId, input.requestId);
  if (!locked) {
    throw new Error("DUPLICATE_REPLY_REQUEST");
  }

  const timingScheduled: TimingJobKind[] = [];

  try {
    await setTypingState(input.sessionId, { active: true, requestId: input.requestId });

    if (input.timing?.read) {
      await scheduleTimingJob({
        kind: "read_delay",
        sessionId: input.sessionId,
        requestId: input.requestId,
        delayMs: input.timing.read,
      });
      timingScheduled.push("read_delay");
    }

    if (input.timing?.typing) {
      await scheduleTimingJob({
        kind: "typing_delay",
        sessionId: input.sessionId,
        requestId: input.requestId,
        delayMs: input.timing.typing,
      });
      timingScheduled.push("typing_delay");
    }

    const reply = await openRouterChat({
      model: input.model,
      messages: input.messages,
      maxTokens: input.maxTokens,
    });

    if (input.timing?.followUp) {
      await scheduleTimingJob({
        kind: "follow_up_delay",
        sessionId: input.sessionId,
        requestId: input.requestId,
        delayMs: input.timing.followUp,
      });
      timingScheduled.push("follow_up_delay");
    }

    return {
      reply,
      source: "openrouter",
      requestId: input.requestId,
      timingScheduled,
    };
  } finally {
    await clearTypingState(input.sessionId);
    await releaseReplyLock(input.sessionId, input.requestId);
  }
}
