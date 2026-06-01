import type { OpenRouterMessage } from "./openrouter-client.js";
import { openRouterChat } from "./openrouter-client.js";
import { createHash } from "crypto";
import {
  acquireConversationLock,
  acquireMessageFingerprint,
  acquireReplyLock,
  releaseConversationLock,
  releaseReplyLock,
} from "../../redis/anti-duplicate.js";
import { setTypingState, clearTypingState } from "../../redis/typing-state.js";
import { scheduleTimingJob, type TimingJobKind } from "../../queue/timing-queue.js";
import { generateAIReply } from "@/lib/agents/business-context/reply";
import { beginReplyTurn, isActiveReplyTurn } from "@/lib/chat/pipeline/central-reply-manager";
import { ConversationPipelineDebugger } from "@/lib/chat/pipeline/conversation-pipeline-debugger";
import { jsonSafe } from "@/lib/chat/pipeline/json-safe";
import {
  buildHydratedState,
  getSessionHistoryAsMessages,
  loadConversationSession,
  saveConversationSession,
} from "@/lib/redis/conversation-session-store";
import {
  appendConversationTurn,
  fromLlmHistory,
  sanitizeConversationHistory,
  toLlmHistory,
  validateConversationHistory,
} from "@/lib/chat/pipeline/conversationHistoryManager";
import { captureEmotionalPersistence, restoreEmotionalPersistence } from "@/lib/redis/emotion-persistence";
import { captureRelationshipMemory, restoreRelationshipMemory } from "@/lib/redis/relationship-memory";
import { captureFollowupMemory } from "@/lib/redis/followup-memory";
import { filterImportantHistory, filterImportantMemoryLines } from "@/lib/redis/memory-importance-score";
import { saveLiveConversationState } from "@/lib/redis/live-conversation-state";
import { loadHumanMemory, saveHumanMemory } from "@/lib/redis/human-memory-store";
import { buildHumanContext, updateHumanMemory } from "@/lib/chat/memory/human-memory-engine";
import { logStructured } from "@/lib/logging/structured-log";
import {
  hasConsecutiveRoles,
  sanitizeConversationStateForLlm,
  sanitizeHistoryForLlm,
  sanitizeReplyTransformationChain,
} from "@/lib/chat/pipeline/contamination-filter";

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
  const t0 = Date.now();
  const normalizedMessage = String(input.message ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const messageFingerprint = createHash("sha1").update(`user:${normalizedMessage}`).digest("hex");
  console.log("[FRONT_SEND]", { session_id: input.session_id, message: input.message, timestamp: Date.now() });
  console.log("[BACKEND_FINGERPRINT]", {
    session_id: input.session_id,
    fingerprint: `user:${messageFingerprint}`,
    timestamp: Date.now(),
  });
  const uniqueMessage = await acquireMessageFingerprint(input.session_id, messageFingerprint);
  if (!uniqueMessage) {
    throw new Error("DUPLICATE_MESSAGE_FINGERPRINT");
  }
  const conversationLocked = await acquireConversationLock(input.session_id, input.request_id);
  if (!conversationLocked) {
    throw new Error("CONVERSATION_LOCK_BUSY");
  }
  const locked = await acquireReplyLock(input.session_id, input.request_id);
  if (!locked) {
    throw new Error("DUPLICATE_REPLY_REQUEST");
  }

  const timingScheduled: TimingJobKind[] = [];

  try {
    console.log("[TRACE]", "generateAIReply_start", {
      ms: Date.now() - t0,
      session_id: input.session_id,
      request_id: input.request_id,
      messageLen: input.message.length,
    });
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

    const redisSession = await loadConversationSession(input.session_id);
    const humanMemoryState = await loadHumanMemory(input.session_id);
    if (humanMemoryState) {
      (input.conversation_state as any) = {
        ...(input.conversation_state ?? {}),
        humanMemoryState,
        humanMemory: humanMemoryState.memories,
        humanEmotionalState: humanMemoryState.emotionalState,
      };
      logStructured("[EMOTIONAL_STATE]", {
        session_id: input.session_id,
        mood: humanMemoryState.emotionalState.mood,
        frustration: humanMemoryState.emotionalState.frustration01,
        trust: humanMemoryState.emotionalState.trust01,
      });
    }
    console.log("[REDIS_BEFORE]", {
      session_id: input.session_id,
      request_id: input.request_id,
      found: Boolean(redisSession),
      count: getSessionHistoryAsMessages(redisSession).length,
    });
    let hydratedState = buildHydratedState({
      incoming: (input.conversation_state ?? {}) as any,
      fromRedis: redisSession,
    });
    if (redisSession?.emotionalState) {
      hydratedState = restoreEmotionalPersistence(hydratedState, {
        mood: (redisSession as any)?.mood,
        frustration: (redisSession as any)?.frustration,
        enthusiasm: (redisSession as any)?.enthusiasm,
        trust: redisSession.trustScore,
        fatigue: (redisSession as any)?.fatigue,
        updatedAt: redisSession.updatedAt,
      });
    }
    hydratedState = restoreRelationshipMemory(hydratedState, (redisSession as any)?.relationshipMemory);
    hydratedState.memory = filterImportantMemoryLines(hydratedState.memory ?? [], 14);
    const mergedRawHistory = filterImportantHistory(
      [...getSessionHistoryAsMessages(redisSession), ...(Array.isArray(input.history) ? input.history : [])],
      20,
    );
    const mergedSanitizedTurns = sanitizeConversationHistory(fromLlmHistory(mergedRawHistory));
    let workingTurns = mergedSanitizedTurns.history;
    const appendedUser = appendConversationTurn(workingTurns, {
      role: "user",
      content: input.message,
      createdAt: Date.now(),
    });
    workingTurns = sanitizeConversationHistory(appendedUser.history).history;
    validateConversationHistory(workingTurns);
    const mergedHistory = toLlmHistory(workingTurns);
    logStructured("[SESSION_HYDRATED]", {
      session_id: input.session_id,
      request_id: input.request_id,
      redisFound: Boolean(redisSession),
      history: mergedHistory.length,
      memory: hydratedState.memory?.length ?? 0,
    });

    const sanitizedConversationState = sanitizeConversationStateForLlm(hydratedState as any);
    console.log("[HISTORY_BEFORE]", {
      session_id: input.session_id,
      request_id: input.request_id,
      count: mergedRawHistory.length,
      tail: mergedRawHistory.slice(-6).map((t) => t.role),
      fingerprints: workingTurns.slice(-6).map((t) => t.fingerprint),
    });
    const sanitizedHistory = sanitizeHistoryForLlm(mergedHistory);
    console.log("[HISTORY_AFTER]", {
      session_id: input.session_id,
      request_id: input.request_id,
      count: sanitizedHistory.history.length,
      tail: sanitizedHistory.history.slice(-6).map((t) => t.role),
      history_quality_score: sanitizedHistory.history_quality_score,
    });
    if (hasConsecutiveRoles(sanitizedHistory.history)) {
      throw new Error("INVALID_HISTORY_STRUCTURE");
    }
    if (sanitizedHistory.dropped > 0 || !sanitizedHistory.validation.ok) {
      console.log("[OPTIMA_MEMORY_STATE] history_sanitized", {
        request_id: input.request_id,
        dropped: sanitizedHistory.dropped,
        kept: sanitizedHistory.history.length,
        history_quality_score: sanitizedHistory.history_quality_score,
        validation_ok: sanitizedHistory.validation.ok,
        validation_reasons: sanitizedHistory.validation.reasons,
      });
    }

    const mainPipeline = (async () => {
      return (await generateAIReply({
        message: input.message,
        userId: input.user_id,
        agentName: input.agent_name,
        agentPersonality: input.agent_personality,
        salesStyle: input.sales_style,
        businessName: input.business_name,
        conversationState: sanitizedConversationState,
        history: sanitizedHistory.history,
        agentRole: input.agent_role,
        agentTone: input.agent_tone,
        personaKey: input.persona_key ?? null,
        followupAfterHold: input.followup_after_hold,
        sessionId: input.session_id_for_reply ?? input.session_id,
        agentId: input.agent_id,
        pipelineDebugger,
        replyTurn,
      })) as Record<string, unknown>;
    })();

    const timeout = new Promise<never>((_, reject) => {
      const ms = 30_000;
      setTimeout(() => reject(new Error(`PIPELINE_TIMEOUT_${ms}MS`)), ms).unref?.();
    });

    const gen = await Promise.race([mainPipeline, timeout]);
    console.log("[TRACE]", "generateAIReply_end", {
      ms: Date.now() - t0,
      session_id: input.session_id,
      request_id: input.request_id,
      replyLen: typeof (gen as any)?.reply === "string" ? (gen as any).reply.length : 0,
    });

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
      replyTransformationChain: sanitizeReplyTransformationChain(
        Array.isArray(gen.replyTransformationChain) ? (gen.replyTransformationChain as any[]) : [],
      ),
      conversation_state_next: (gen as any)?.conversationStateNext ?? undefined,
      supervisorInsights: gen.supervisorInsights,
      emotionalSupervisorInsights: gen.emotionalSupervisorInsights,
      personalitySupervisorInsights: gen.personalitySupervisorInsights,
      socialSupervisorInsights: gen.socialSupervisorInsights,
      replyOwnership: gen.replyOwnership,
      liveOrchestrator: liveSafe,
    };
    const conversationStateNext = (gen as any)?.conversationStateNext as Record<string, unknown> | undefined;
    const finalState = (conversationStateNext ?? sanitizedConversationState) as any;
    finalState.followupMemory = captureFollowupMemory(String(gen.reply ?? ""), finalState);
    finalState.relationshipMemory = captureRelationshipMemory(finalState);
    const emotionPersist = captureEmotionalPersistence(finalState);
    if (emotionPersist) {
      finalState.emotionPersistence = emotionPersist;
    }
    const compactHistory = filterImportantHistory(
      [...mergedHistory, { role: "assistant", content: String(gen.reply ?? "") }],
      18,
    );
    const compactTurns = sanitizeConversationHistory(fromLlmHistory(compactHistory)).history;
    validateConversationHistory(compactTurns);
    const compactSanitized = sanitizeHistoryForLlm(toLlmHistory(compactTurns));
    await saveConversationSession({
      sessionId: input.session_id,
      state: finalState,
      history: toLlmHistory(compactTurns),
    });
    const nextHumanMemory = updateHumanMemory({
      previous: humanMemoryState ?? undefined,
      userMessage: input.message,
      assistantReply: String(gen.reply ?? ""),
      turnsTogether: Number(finalState?.stats?.turn_count ?? 0),
    });
    const humanContextPreview = buildHumanContext({ memoryState: nextHumanMemory, maxItems: 4 });
    logStructured("[HUMAN_MEMORY_EXTRACTED]", {
      session_id: input.session_id,
      extracted_count: nextHumanMemory.memories.length,
      context_preview: humanContextPreview,
    });
    for (const m of nextHumanMemory.memories.slice(0, 8)) {
      logStructured("[MEMORY_IMPORTANCE_SCORE]", {
        session_id: input.session_id,
        category: m.category,
        content: m.content,
        importance: m.importanceScore,
        emotionalWeight: m.emotionalWeight,
      });
    }
    await saveHumanMemory(input.session_id, nextHumanMemory);
    console.log("[REDIS_AFTER]", {
      session_id: input.session_id,
      request_id: input.request_id,
      count: compactTurns.length,
      fingerprints: compactTurns.slice(-6).map((t) => t.fingerprint),
    });
    await saveLiveConversationState(input.session_id, {
      typingState: { active: false, requestId: input.request_id, updatedAt: Date.now() },
      readState: { seen: true, lastReadAt: Date.now() },
      emotionalState: finalState.prospectEmotionalState,
      lastActivityAt: Date.now(),
      humanizationTiming: {
        totalMs: Number(orchestrator_pipeline_debug?.totalMs ?? 0),
        responseMode: String(orchestrator_pipeline_debug?.responseMode ?? ""),
      },
    });
    logStructured("[MEMORY_COMPRESSED]", {
      session_id: input.session_id,
      request_id: input.request_id,
      compactHistory: compactHistory.length,
      memory: finalState.memory?.length ?? 0,
    });

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
    await releaseConversationLock(input.session_id, input.request_id);
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
