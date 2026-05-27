import type { HumanValidatorDecision } from "../pipeline/pipeline-types";

export const MIN_HUMAN_REPLY_LENGTH = 18;

const EXCEPTIONS = new Set(["ok", "oui", "non", "ça marche", "ca marche", "😂", "👍"]);

function normalize(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function validateHumanReplyLength(reply: string): HumanValidatorDecision {
  const text = String(reply ?? "").trim();
  const n = normalize(text);
  if (EXCEPTIONS.has(n)) return { ok: true, reason: "exception_allowed" };
  if (text.length >= MIN_HUMAN_REPLY_LENGTH) return { ok: true, reason: "min_length_ok" };
  return { ok: false, reason: "too_short", minLen: MIN_HUMAN_REPLY_LENGTH, actualLen: text.length };
}

