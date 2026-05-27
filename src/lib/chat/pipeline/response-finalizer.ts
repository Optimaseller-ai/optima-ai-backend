import "server-only";

import { ensureHumanFallbackReply, type ContextualFallbackInput } from "./contextual-fallbacks";
import { isInvalidCollapsedReply } from "./reply-transformation-chain";
import type { ConversationPipelineRuntimeSnapshot } from "./pipeline-types";
import { jsonSafe } from "./json-safe";

export type FinalizeChatResponseInput = {
  reply: string;
  pipelineSnapshot: ConversationPipelineRuntimeSnapshot;
  /** Erreur fatale uniquement (crash handler) — pas les dégradations gracieuses. */
  fatalError?: string | null;
  fallbackInput: ContextualFallbackInput;
  payload: Record<string, unknown>;
};

export type FinalizedChatResponse = {
  success: boolean;
  error: string | null;
  reply: string;
  payload: Record<string, unknown>;
  finalized: {
    replyValid: boolean;
    pipelineCompleted: boolean;
    serializable: boolean;
    usedReplyFallback: boolean;
  };
};

/**
 * Valide réponse + payload avant envoi client.
 * Règle produit : reply exploitable + pas de crash fatal → success:true, error:null.
 */
export function finalizeChatSendResponse(input: FinalizeChatResponseInput): FinalizedChatResponse {
  const fatal = input.fatalError ? String(input.fatalError).trim() : "";
  let reply = String(input.reply ?? "").trim();

  const pipelineCompleted = Boolean(input.pipelineSnapshot.completedAt);
  const hasFatalStep = input.pipelineSnapshot.steps.some((s) => s.status === "failed");
  let usedReplyFallback = false;

  if (!fatal) {
    const before = reply;
    reply = ensureHumanFallbackReply(reply, input.fallbackInput);
    if (!before || before !== reply) usedReplyFallback = true;
  }

  const replyValid = !isInvalidCollapsedReply(reply) && reply.length > 0;

  const success = !fatal && replyValid && !hasFatalStep;
  const error = success ? null : fatal || (hasFatalStep ? "PIPELINE_FATAL" : "INVALID_REPLY");

  let serializable = true;
  let safePayload: Record<string, unknown>;
  try {
    safePayload = jsonSafe(
      {
        ...input.payload,
        success,
        error,
        reply,
      },
      { success, error, reply },
    );
  } catch {
    serializable = false;
    safePayload = { success, error: error ?? "RESPONSE_SERIALIZE", reply };
  }

  return {
    success,
    error,
    reply,
    payload: safePayload,
    finalized: {
      replyValid,
      pipelineCompleted,
      serializable,
      usedReplyFallback,
    },
  };
}
