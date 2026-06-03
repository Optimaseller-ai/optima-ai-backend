import { logStructured } from "@/lib/logging/structured-log";
import {
  fromLlmHistory,
  sanitizeConversationHistory,
  stripLeadingAssistantPreload,
  toLlmHistory,
  validateConversationHistory,
  type ConversationTurn,
} from "./conversationHistoryManager";
import { validateHistoryForLLM } from "./contamination-filter";

const STATIC_INTRO_SEED_RE =
  /\b(bonjour\s+et\s+bienvenue|bonsoir\.?\s*bienvenue|bienvenue\s+chez|je\s+suis\s+.+\s+du\s+service\s+client|dites-moi\s+(ce\s+que\s+vous\s+)?cherchez|votre\s+budget)\b/i;

export function isStaticIntroSeedContent(content: string): boolean {
  return STATIC_INTRO_SEED_RE.test(String(content ?? ""));
}

function mergeConsecutiveSameRole(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): { history: Array<{ role: "user" | "assistant"; content: string }>; merged: number } {
  const list = Array.isArray(history) ? history : [];
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  let merged = 0;
  for (const turn of list) {
    if (!turn?.content?.trim()) continue;
    const last = out[out.length - 1];
    if (last && last.role === turn.role) {
      last.content = [last.content, String(turn.content).trim()].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      merged++;
      continue;
    }
    out.push({ role: turn.role, content: String(turn.content).trim() });
  }
  return { history: out, merged };
}

function repairInvalidTurns(turns: ConversationTurn[]): ConversationTurn[] {
  const list = Array.isArray(turns) ? [...turns] : [];
  if (!list.length) return list;
  const repaired: ConversationTurn[] = [list[0]!];
  for (let i = 1; i < list.length; i++) {
    const cur = list[i]!;
    const prev = repaired[repaired.length - 1]!;
    if (prev.role === cur.role) {
      prev.content = [prev.content, cur.content].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      prev.fingerprint = `${prev.role}:${prev.content}`.trim().toLowerCase().replace(/\s+/g, " ");
      logStructured("[FINAL_HISTORY_REPAIRED]", { index: i, role: cur.role, reason: "merge_consecutive_roles" });
      continue;
    }
    repaired.push(cur);
  }
  return repaired;
}

/**
 * Mandatory gate before Railway, LLM payloads, or Redis history writes.
 */
export function ensureFinalConversationHistory(
  history: Array<{ role: "user" | "assistant"; content: string }> | undefined,
): {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  repaired: boolean;
  blocked: boolean;
} {
  let list = Array.isArray(history) ? [...history] : [];
  let repaired = false;

  const preload = stripLeadingAssistantPreload(list);
  if (preload.removed > 0) {
    repaired = true;
    logStructured("[INVALID_ASSISTANT_PRELOAD]", { removed: preload.removed, phase: "final_gate" });
  }
  list = preload.history;

  const withoutIntroSeeds = list.filter((t) => !isStaticIntroSeedContent(t.content));
  if (withoutIntroSeeds.length < list.length) {
    repaired = true;
    logStructured("[FINAL_HISTORY_REPAIRED]", {
      reason: "static_intro_seed_removed",
      removed: list.length - withoutIntroSeeds.length,
    });
    list = withoutIntroSeeds;
  }

  const merged = mergeConsecutiveSameRole(list);
  if (merged.merged > 0) {
    repaired = true;
    logStructured("[FINAL_HISTORY_REPAIRED]", { reason: "merge_consecutive_raw", merged: merged.merged });
  }
  list = merged.history;

  let turns = sanitizeConversationHistory(fromLlmHistory(list)).history;

  try {
    validateConversationHistory(turns);
  } catch {
    turns = repairInvalidTurns(turns);
    turns = sanitizeConversationHistory(turns).history;
    repaired = true;
    try {
      validateConversationHistory(turns);
    } catch (e) {
      logStructured("[INVALID_HISTORY_BLOCKED]", {
        reason: e instanceof Error ? e.message : String(e),
      });
      return { history: [], repaired: true, blocked: true };
    }
  }

  const llmShape = toLlmHistory(turns);
  const validation = validateHistoryForLLM(llmShape);
  if (!validation.ok) {
    repaired = true;
    logStructured("[FINAL_HISTORY_REPAIRED]", { reason: "llm_validation", issues: validation.reasons });
  }

  logStructured("[FINAL_HISTORY_VALIDATED]", {
    count: llmShape.length,
    repaired,
    tail: llmShape.slice(-4).map((t) => t.role),
  });

  return { history: llmShape, repaired, blocked: false };
}
