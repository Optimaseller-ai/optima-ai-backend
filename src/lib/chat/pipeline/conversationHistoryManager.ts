import { randomUUID } from "crypto";

export type ConversationTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  fingerprint: string;
};

export function buildFingerprint(role: string, content: string): string {
  return `${role}:${String(content ?? "")}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeContent(content: string): string {
  return String(content ?? "").replace(/\s+/g, " ").trim();
}

function asTurn(input: Partial<ConversationTurn> & { role: "user" | "assistant"; content: string }): ConversationTurn {
  const content = normalizeContent(input.content);
  return {
    id: input.id ?? randomUUID(),
    role: input.role,
    content,
    createdAt: Number.isFinite(input.createdAt) ? Number(input.createdAt) : Date.now(),
    fingerprint: buildFingerprint(input.role, content),
  };
}

export function fromLlmHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): ConversationTurn[] {
  const arr = Array.isArray(history) ? history : [];
  return arr.map((h) => asTurn({ role: h.role, content: h.content }));
}

export function toLlmHistory(
  history: ConversationTurn[],
): Array<{ role: "user" | "assistant"; content: string }> {
  return (Array.isArray(history) ? history : []).map((h) => ({ role: h.role, content: h.content }));
}

export function sanitizeConversationHistory(history: ConversationTurn[]): {
  history: ConversationTurn[];
  removedEmpty: number;
  removedDuplicates: number;
  removedRepeats: number;
  alternanceRepairs: number;
} {
  const src = Array.isArray(history) ? history : [];
  const clean: ConversationTurn[] = [];
  let removedEmpty = 0;
  let removedDuplicates = 0;
  let removedRepeats = 0;
  let alternanceRepairs = 0;

  for (const raw of src) {
    if (!raw || (raw.role !== "user" && raw.role !== "assistant")) {
      removedEmpty++;
      continue;
    }
    const turn = asTurn(raw);
    if (!turn.content || turn.content.length < 1) {
      removedEmpty++;
      continue;
    }

    const last = clean[clean.length - 1];
    if (last && last.fingerprint === turn.fingerprint) {
      removedDuplicates++;
      continue;
    }

    const repeatsInLast10 = clean.slice(-10).filter((t) => t.fingerprint === turn.fingerprint).length;
    if (repeatsInLast10 >= 2) {
      removedRepeats++;
      continue;
    }

    if (last && last.role === turn.role) {
      clean[clean.length - 1] = turn;
      alternanceRepairs++;
      continue;
    }

    clean.push(turn);
  }

  const bounded = clean.slice(-20);
  return { history: bounded, removedEmpty, removedDuplicates, removedRepeats, alternanceRepairs };
}

export function appendConversationTurn(history: ConversationTurn[], input: {
  role: "user" | "assistant";
  content: string;
  createdAt?: number;
  id?: string;
}): {
  history: ConversationTurn[];
  appended: boolean;
  reason?: "duplicate_consecutive" | "repeat_limit" | "alternance_repair";
} {
  const base = Array.isArray(history) ? [...history] : [];
  const turn = asTurn(input);
  if (!turn.content) return { history: base, appended: false };
  const last = base[base.length - 1];
  if (last && last.fingerprint === turn.fingerprint) {
    return { history: base, appended: false, reason: "duplicate_consecutive" };
  }
  const repeatsInLast10 = base.slice(-10).filter((t) => t.fingerprint === turn.fingerprint).length;
  if (repeatsInLast10 >= 2) {
    return { history: base, appended: false, reason: "repeat_limit" };
  }
  if (last && last.role === turn.role) {
    base[base.length - 1] = turn;
    return { history: base, appended: true, reason: "alternance_repair" };
  }
  base.push(turn);
  return { history: base, appended: true };
}

/** Remove phantom assistant preloads at the start of history (before any user turn). */
export function stripLeadingAssistantPreload(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): { history: Array<{ role: "user" | "assistant"; content: string }>; removed: number } {
  const list = Array.isArray(history) ? [...history] : [];
  let removed = 0;
  while (list.length > 0 && list[0]!.role === "assistant") {
    list.shift();
    removed++;
  }
  return { history: list, removed };
}

export function validateConversationHistory(history: ConversationTurn[]): void {
  const list = Array.isArray(history) ? history : [];
  if (!list.length) throw new Error("INVALID_HISTORY_EMPTY");
  for (let i = 0; i < list.length; i++) {
    const cur = list[i]!;
    if (cur.role !== "user" && cur.role !== "assistant") throw new Error("INVALID_HISTORY_ROLE");
    if (!String(cur.content ?? "").trim()) throw new Error("INVALID_HISTORY_EMPTY_CONTENT");
    if (i > 0 && list[i - 1]!.role === cur.role) throw new Error("INVALID_CONSECUTIVE_ROLES");
  }
}

export function computeHistoryQualityScore(history: ConversationTurn[]): number {
  const list = Array.isArray(history) ? history : [];
  if (!list.length) return 0;
  let alternanceBreaks = 0;
  for (let i = 1; i < list.length; i++) {
    if (list[i]!.role === list[i - 1]!.role) alternanceBreaks++;
  }
  const alternance = Math.max(0, 1 - alternanceBreaks / Math.max(1, list.length - 1));
  const diversity = new Set(list.map((t) => t.fingerprint)).size / Math.max(1, list.length);
  const avgLen = list.reduce((a, b) => a + b.content.length, 0) / Math.max(1, list.length);
  const coherence = Math.min(1, avgLen / 40);
  return Number((0.45 * alternance + 0.35 * diversity + 0.2 * coherence).toFixed(3));
}

