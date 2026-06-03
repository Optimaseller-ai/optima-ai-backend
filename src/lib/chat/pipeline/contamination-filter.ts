import {
  computeHistoryQualityScore as computeHistoryQualityScoreManager,
  fromLlmHistory,
  sanitizeConversationHistory as sanitizeConversationHistoryManager,
  stripLeadingAssistantPreload,
  toLlmHistory,
  validateConversationHistory,
} from "./conversationHistoryManager";
import { logStructured } from "@/lib/logging/structured-log";

export const SYSTEM_MEMORY_BLACKLIST = [
  "je suis là",
  "que recherchez-vous",
  "comment puis-je",
  "n'hésitez pas",
  "n’hésitez pas",
  "dis-moi ce qui t’intéresse",
  "dis-moi ce qui t'interesse",
  "dis-moi ce qui t interesse",
  "je peux vous aider",
  "papoter",
  "si tu veux des infos",
] as const;

function normalizeText(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function hasContaminationPhrase(text: string): boolean {
  const t = normalizeText(text);
  if (!t) return false;
  if (SYSTEM_MEMORY_BLACKLIST.some((p) => t.includes(normalizeText(p)))) return true;
  if (/(tu|vous)\s+cherch(e|ez)\s+quelque\s+chose\s+en\s+particulier/i.test(t)) return true;
  if (/dis[-\s]?moi\s+ce\s+qui\s+(t|vous)\s+int[ée]resse/i.test(t)) return true;
  if (/si\s+vous\s+avez\s+des\s+questions?/i.test(t)) return true;
  return false;
}

export function sanitizeHistoryForLlm(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  dropped: number;
  history_quality_score: number;
  validation: { ok: boolean; reasons: string[] };
} {
  const list = Array.isArray(history) ? history : [];
  const beforeCount = list.length;
  const preloaded = stripLeadingAssistantPreload(list);
  if (preloaded.removed > 0) {
    logStructured("[INVALID_ASSISTANT_PRELOAD]", {
      removed: preloaded.removed,
      before_count: beforeCount,
      after_count: preloaded.history.length,
    });
  }
  const turns = fromLlmHistory(preloaded.history);
  const sanitizedTurns = sanitizeConversationHistoryManager(turns);
  const sanitizedHistory = toLlmHistory(sanitizedTurns.history);
  const validation = validateHistoryForLLM(sanitizedHistory);
  const quality = computeHistoryQualityScore(sanitizedTurns.history);
  console.log("[HISTORY_SANITIZED]", {
    before_count: beforeCount,
    after_count: sanitizedHistory.length,
    dropped:
      sanitizedTurns.removedEmpty +
      sanitizedTurns.removedDuplicates +
      sanitizedTurns.removedRepeats,
    history_quality_score: quality,
  });
  return {
    history: sanitizedHistory,
    dropped:
      sanitizedTurns.removedEmpty +
      sanitizedTurns.removedDuplicates +
      sanitizedTurns.removedRepeats,
    history_quality_score: quality,
    validation,
  };
}

export function hasConsecutiveRoles(history: Array<{ role: "user" | "assistant"; content: string }>): boolean {
  for (let i = 1; i < history.length; i++) {
    if (history[i]!.role === history[i - 1]!.role) return true;
  }
  return false;
}

function normalizeHistoryContent(s: string): string {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function isTooShortNoise(content: string): boolean {
  const n = normalizeHistoryContent(content);
  if (!n) return true;
  if (n.length < 2) return true;
  if (/^(ok|oui|non|hm+|hmm+|euh|ah|yo)$/.test(n)) return true;
  return false;
}

export function sanitizeConversationHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): { history: Array<{ role: "user" | "assistant"; content: string }>; dropped: number } {
  const turns = fromLlmHistory(Array.isArray(history) ? history : []);
  const sanitized = sanitizeConversationHistoryManager(
    turns.filter((t) => !isTooShortNoise(t.content) && !hasContaminationPhrase(t.content)),
  );
  if (sanitized.removedDuplicates > 0) {
    console.log("[HISTORY_DUPLICATE_BLOCKED]", { removed: sanitized.removedDuplicates });
  }
  if (sanitized.removedRepeats > 0) {
    console.log("[HISTORY_REPEAT_LIMIT_BLOCKED]", { removed: sanitized.removedRepeats });
  }
  if (sanitized.alternanceRepairs > 0) {
    console.log("[HISTORY_ALTERNANCE_REPAIRED]", { repaired: sanitized.alternanceRepairs });
  }
  const dropped = sanitized.removedEmpty + sanitized.removedDuplicates + sanitized.removedRepeats;
  return { history: toLlmHistory(sanitized.history), dropped };
}

export function validateHistoryForLLM(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const list = Array.isArray(history) ? history : [];
  if (!list.length) reasons.push("empty_history");

  for (let i = 0; i < list.length; i++) {
    const cur = list[i]!;
    const content = String(cur.content ?? "").trim();
    if (!content) reasons.push(`empty_content_at_${i}`);
    if (content.length > 900) reasons.push(`too_long_content_at_${i}`);
    if (i > 0 && list[i - 1]!.role === cur.role) reasons.push(`alternance_broken_at_${i}`);
  }

  const normalized = list.map((t) => normalizeHistoryContent(t.content));
  const unique = new Set(normalized);
  const repeatedRatio = list.length ? 1 - unique.size / list.length : 0;
  if (repeatedRatio > 0.45) reasons.push("repeated_ratio_too_high");

  return { ok: reasons.length === 0, reasons };
}

function computeHistoryQualityScore(history: Array<{ role: "user" | "assistant"; content: string }>): number {
  const turns = fromLlmHistory(Array.isArray(history) ? history : []);
  return computeHistoryQualityScoreManager(turns);
}

function deepCleanUnknown(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return hasContaminationPhrase(value) ? null : value;
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => deepCleanUnknown(v))
      .filter((v) => v !== null && v !== undefined && !(typeof v === "string" && !String(v).trim()));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const next = deepCleanUnknown(v);
      if (next === null || next === undefined) continue;
      if (typeof next === "string" && !next.trim()) continue;
      out[k] = next;
    }
    return out;
  }
  return value;
}

export function sanitizeConversationStateForLlm<T>(state: T): T {
  if (!state || typeof state !== "object") return state;
  return deepCleanUnknown(state) as T;
}

export function sanitizeReplyTransformationChain<T extends { beforeText?: string; afterText?: string }>(logs: T[]): T[] {
  if (!Array.isArray(logs)) return [];
  return logs.filter((l) => {
    const before = String(l?.beforeText ?? "");
    const after = String(l?.afterText ?? "");
    return !hasContaminationPhrase(before) && !hasContaminationPhrase(after);
  });
}

