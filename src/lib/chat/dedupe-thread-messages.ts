/**
 * Déduplication fil de chat — même texte assistant ne doit pas apparaître deux fois
 * (client ts ≠ serveur ts, sync + emit, ou double persist).
 */

export function normalizeMessageContent(content: string): string {
  return String(content ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Empreinte stable pour messages assistant (ignore ts / id). */
export function assistantContentKey(content: string): string {
  return normalizeMessageContent(content);
}

export function userContentKey(content: string, ts?: string): string {
  const c = normalizeMessageContent(content);
  const t = String(ts ?? "").trim();
  return t ? `user\0${t}\0${c}` : `user\0${c}`;
}

export function isDuplicateAssistantInThread(
  messages: Array<{ role: string; content?: string; typing?: boolean }>,
  content: string,
  lookback = 4,
): boolean {
  const key = assistantContentKey(content);
  if (!key) return false;
  const tail = messages
    .filter((m) => m.role === "assistant" && !m.typing)
    .slice(-lookback);
  return tail.some((m) => assistantContentKey(String(m.content ?? "")) === key);
}

export type ThreadMessageLike = {
  role: "user" | "assistant" | string;
  content: string;
  ts?: string;
  id?: string;
  typing?: boolean;
};

/** Supprime doublons consécutifs / récents (assistant = même contenu). */
export function dedupeThreadMessages<T extends ThreadMessageLike>(messages: T[]): T[] {
  const out: T[] = [];
  const seenAssistant = new Set<string>();
  const seenUser = new Set<string>();

  for (const m of messages) {
    if ((m as { typing?: boolean }).typing) {
      out.push(m);
      continue;
    }
    const content = String(m.content ?? "").trim();
    if (!content && m.role !== "user") continue;

    if (m.role === "assistant") {
      const key = assistantContentKey(content);
      if (!key || seenAssistant.has(key)) continue;
      seenAssistant.add(key);
      out.push(m);
      continue;
    }

    if (m.role === "user") {
      const key = userContentKey(content, m.ts);
      if (seenUser.has(key)) continue;
      seenUser.add(key);
      out.push(m);
      continue;
    }

    out.push(m);
  }

  return out;
}
