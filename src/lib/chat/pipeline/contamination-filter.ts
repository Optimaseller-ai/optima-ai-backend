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
  const sanitized = sanitizeConversationHistory(list);
  const validation = validateHistoryForLLM(sanitized.history);
  const quality = computeHistoryQualityScore(sanitized.history);
  console.log("[HISTORY_SANITIZED]", {
    before_count: beforeCount,
    after_count: sanitized.history.length,
    dropped: sanitized.dropped,
    history_quality_score: quality,
  });
  return {
    history: sanitized.history,
    dropped: sanitized.dropped,
    history_quality_score: quality,
    validation,
  };
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
  const list = Array.isArray(history) ? history : [];
  const clean: Array<{ role: "user" | "assistant"; content: string }> = [];
  let dropped = 0;

  for (const turn of list) {
    const role = turn?.role === "assistant" ? "assistant" : "user";
    const content = String(turn?.content ?? "").trim().replace(/\s+/g, " ");
    const norm = normalizeHistoryContent(content);

    if (!norm || isTooShortNoise(content) || hasContaminationPhrase(content)) {
      dropped += 1;
      continue;
    }

    // Block exact consecutive duplicates by same role.
    const last = clean[clean.length - 1];
    if (last && last.role === role && normalizeHistoryContent(last.content) === norm) {
      dropped += 1;
      console.log("[HISTORY_DUPLICATE_BLOCKED]", { role, content: norm.slice(0, 80) });
      continue;
    }

    // Limit repetitions: same normalized message >2 times in last 10 turns.
    const recent = clean.slice(-10);
    const repeatCount = recent.filter((t) => normalizeHistoryContent(t.content) === norm).length;
    if (repeatCount >= 2) {
      dropped += 1;
      console.log("[HISTORY_REPEAT_LIMIT_BLOCKED]", { role, content: norm.slice(0, 80), repeatCount: repeatCount + 1 });
      continue;
    }

    // Force alternance: never push same role in a row; replace last with newest.
    if (last && last.role === role) {
      clean[clean.length - 1] = { role, content };
      console.log("[HISTORY_ALTERNANCE_REPAIRED]", { role, mode: "replace_last" });
      continue;
    }

    clean.push({ role, content });
  }

  // Keep recent bounded history for LLM.
  const bounded = clean.slice(-24);
  dropped += clean.length - bounded.length;
  return { history: bounded, dropped };
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
  const list = Array.isArray(history) ? history : [];
  if (!list.length) return 0;

  let alternanceBreaks = 0;
  for (let i = 1; i < list.length; i++) {
    if (list[i]!.role === list[i - 1]!.role) alternanceBreaks += 1;
  }
  const alternanceScore = Math.max(0, 1 - alternanceBreaks / Math.max(1, list.length - 1));
  const normalized = list.map((t) => normalizeHistoryContent(t.content));
  const diversityScore = new Set(normalized).size / Math.max(1, list.length);
  const avgLen = normalized.reduce((a, b) => a + b.length, 0) / Math.max(1, normalized.length);
  const coherenceScore = Math.min(1, avgLen / 40);
  const repetitionPenalty = Math.max(0, 1 - (1 - diversityScore));
  const score = 0.4 * alternanceScore + 0.25 * diversityScore + 0.2 * coherenceScore + 0.15 * repetitionPenalty;
  return Number(score.toFixed(3));
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

