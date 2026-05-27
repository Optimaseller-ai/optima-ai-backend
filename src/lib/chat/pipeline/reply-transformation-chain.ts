import "server-only";

import type { ContextualFallbackInput } from "./contextual-fallbacks";
import { ensureHumanFallbackReply, getContextualFallback, isBannedHoldFallback } from "./contextual-fallbacks";

export type ReplyTransformStep =
  | "initial"
  | "anti_ai_filter"
  | "anti_ai_v3"
  | "message_shortener"
  | "orchestrator"
  | "coherence"
  | "humanization"
  | "mastery"
  | "reality"
  | "social_existence"
  | "subconscious"
  | "whatsapp_presence"
  | "human_guard"
  | "personality_polish"
  | "sanitize_hold"
  | "post_process"
  | "response_cleaner"
  | "splitter"
  | "final_guard";

export type ReplyTransformLog = {
  step: ReplyTransformStep;
  beforeText: string;
  afterText: string;
  transformationReason: string;
  textLengthDelta: number;
  ms?: number;
};

export type ReplyTransformationChainResult = {
  text: string;
  logs: ReplyTransformLog[];
  restoredFromFallback: boolean;
  collapsePrevented: boolean;
};

const PUNCTUATION_ONLY = /^[\s.!?…,;:'"«»\-–—]+$/u;
const MIN_VALID_LEN = 8;

/** Réponse invalide : vide, ponctuation seule, 1 caractère, hold interdit. */
export function isInvalidCollapsedReply(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return true;
  if (t.length < MIN_VALID_LEN) return true;
  if (PUNCTUATION_ONLY.test(t)) return true;
  if (isBannedHoldFallback(t)) return true;
  return false;
}

function logStep(
  logs: ReplyTransformLog[],
  step: ReplyTransformStep,
  before: string,
  after: string,
  reason: string,
  ms?: number,
) {
  const entry: ReplyTransformLog = {
    step,
    beforeText: before.slice(0, 280),
    afterText: after.slice(0, 280),
    transformationReason: reason,
    textLengthDelta: after.length - before.length,
    ms,
  };
  logs.push(entry);
  if (entry.textLengthDelta <= -12 || isInvalidCollapsedReply(after)) {
    console.warn("[OPTIMA_REPLY_TRANSFORM]", {
      step,
      reason,
      beforeLen: before.length,
      afterLen: after.length,
      afterPreview: after.slice(0, 80),
    });
  }
}

export type ApplyTransformFn = (text: string) => string;

/**
 * Applique une chaîne de transformations avec garde anti-effondrement.
 */
export function runReplyTransformationChain(args: {
  initialText: string;
  steps: Array<{ step: ReplyTransformStep; reason: string; transform: ApplyTransformFn }>;
  fallbackInput: ContextualFallbackInput;
}): ReplyTransformationChainResult {
  const logs: ReplyTransformLog[] = [];
  let text = String(args.initialText ?? "").trim();
  let lastValid = isInvalidCollapsedReply(text)
    ? getContextualFallback(args.fallbackInput)
    : text;

  logStep(logs, "initial", "", text, "raw_input");

  for (const { step, reason, transform } of args.steps) {
    const before = text;
    const t0 = Date.now();
    let after: string;
    try {
      after = String(transform(before) ?? "").trim();
    } catch (err) {
      console.error("[OPTIMA_REPLY_TRANSFORM_FAIL]", step, err);
      after = lastValid;
      logStep(logs, step, before, after, `engine_error:${reason}`, Date.now() - t0);
      continue;
    }

    if (!isInvalidCollapsedReply(after)) {
      lastValid = after;
    } else if (!isInvalidCollapsedReply(before)) {
      after = before;
      logStep(logs, step, before, after, `collapse_blocked:${reason}`, Date.now() - t0);
      continue;
    }

    logStep(logs, step, before, after, reason, Date.now() - t0);
    text = after;
  }

  let restoredFromFallback = false;
  let collapsePrevented = false;

  if (isInvalidCollapsedReply(text)) {
    collapsePrevented = true;
    if (!isInvalidCollapsedReply(lastValid)) {
      text = lastValid;
      logStep(logs, "final_guard", "", text, "restored_last_valid");
    } else {
      text = ensureHumanFallbackReply("", args.fallbackInput);
      restoredFromFallback = true;
      logStep(logs, "final_guard", "", text, "contextual_fallback");
    }
  }

  return { text, logs, restoredFromFallback, collapsePrevented };
}
