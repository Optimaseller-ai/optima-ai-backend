/**
 * Orchestrateur de réponse — Phase 1 (OpenRouter).
 * Les modules timing / social / memory / fallback s'ajoutent ici sans toucher Vercel.
 */

import type { OpenRouterMessage } from "./openrouter-client.js";
import { openRouterChat } from "./openrouter-client.js";
import { acquireReplyLock, releaseReplyLock } from "../../redis/anti-duplicate.js";
import { setTypingState, clearTypingState } from "../../redis/typing-state.js";
import { scheduleTimingJob, type TimingJobKind } from "../../queue/timing-queue.js";

export type ReplyTimingDelays = {
  read?: number;
  typing?: number;
  followUp?: number;
};

export type ReplyOrchestrationInput = {
  sessionId: string;
  requestId: string;
  message: string;
  messages: OpenRouterMessage[];
  model?: string;
  maxTokens?: number;
  /** Jobs humains optionnels (read / typing / follow-up) */
  timing?: ReplyTimingDelays;
};

export type ReplyOrchestrationResult = {
  reply: string;
  source: "openrouter";
  requestId: string;
  timingScheduled: TimingJobKind[];
};

export async function runReplyOrchestration(
  input: ReplyOrchestrationInput,
): Promise<ReplyOrchestrationResult> {
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
