/**
 * Phase 1 thin OpenRouter path (legacy name `runReplyOrchestration`).
 * Full seller brain: `runFullSellerReplyOrchestration` in full-seller-reply-orchestrator.ts
 */

import type { OpenRouterMessage } from "./openrouter-client.js";
import type { TimingJobKind } from "../../queue/timing-queue.js";
import { runReplyOrchestrationPhase1OpenRouter } from "./full-seller-reply-orchestrator.js";

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
  timing?: ReplyTimingDelays;
};

export type ReplyOrchestrationResult = {
  reply: string;
  source: "openrouter";
  requestId: string;
  timingScheduled: TimingJobKind[];
};

export async function runReplyOrchestration(input: ReplyOrchestrationInput): Promise<ReplyOrchestrationResult> {
  return runReplyOrchestrationPhase1OpenRouter(input);
}
