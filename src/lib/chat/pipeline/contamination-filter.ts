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
): { history: Array<{ role: "user" | "assistant"; content: string }>; dropped: number } {
  const list = Array.isArray(history) ? history : [];
  const clean: Array<{ role: "user" | "assistant"; content: string }> = [];
  let dropped = 0;
  for (const turn of list) {
    const content = String(turn?.content ?? "").trim();
    if (!content) {
      dropped += 1;
      continue;
    }
    if (hasContaminationPhrase(content)) {
      dropped += 1;
      continue;
    }
    clean.push({ role: turn.role, content });
  }
  return { history: clean, dropped };
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

