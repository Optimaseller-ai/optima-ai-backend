const LOW_VALUE_ONLY =
  /^(ok|okay|oui|non|salut|bonjour|bonsoir|merci|thanks|thx|d['’]?accord|ca marche|ça marche|cc|coucou|bjr|mdr|lol|👍|🙏)$/i;

const LOW_VALUE_PREFIX =
  /^(derni[eè]re\s+r[eé]ponse\s+agent:\s*)?(ok|okay|d['’]?accord|oui|non|ca marche|ça marche)\s*$/i;

export type MemoryImportanceResult = {
  score: number;
  keep: boolean;
  reason: string;
};

function norm(s: string): string {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function scoreMemoryImportance(input: {
  text: string;
  role?: "user" | "assistant" | "system";
  kind?: "fact" | "history" | "objection" | "preference" | "emotion";
}): MemoryImportanceResult {
  const text = String(input.text ?? "").trim();
  const n = norm(text);
  if (!n || n.length < 4) return { score: 0, keep: false, reason: "too_short" };
  if (LOW_VALUE_ONLY.test(n) || LOW_VALUE_PREFIX.test(n)) {
    return { score: 0.05, keep: false, reason: "low_value_phrase" };
  }

  let score = 0.35;
  if (input.kind === "emotion") score += 0.35;
  if (input.kind === "objection") score += 0.3;
  if (input.kind === "preference") score += 0.25;
  if (/\b(budget|prix|freepods|iphone|samsung|livraison|commander|stock|garantie)\b/i.test(n)) score += 0.25;
  if (/\b(frustr|énerv|enerve|triste|content|super|merci beaucoup)\b/i.test(n)) score += 0.15;
  if (text.length >= 24) score += 0.1;
  if (text.length >= 80) score += 0.1;
  if (input.role === "assistant" && text.length < 16) score -= 0.2;

  const keep = score >= 0.45;
  return { score: Math.max(0, Math.min(1, score)), keep, reason: keep ? "useful_signal" : "low_signal" };
}

export function filterImportantMemoryLines(lines: string[], limit = 12): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const scored = scoreMemoryImportance({ text: line, kind: "fact" });
    if (!scored.keep) continue;
    out.push(line.trim());
    if (out.length >= limit) break;
  }
  return out;
}

export function filterImportantHistory<T extends { role: "user" | "assistant"; content: string }>(
  history: T[],
  maxTurns = 12,
): T[] {
  const kept: T[] = [];
  for (const turn of history) {
    const scored = scoreMemoryImportance({
      text: turn.content,
      role: turn.role,
      kind: "history",
    });
    if (!scored.keep && turn.role === "user" && turn.content.trim().length <= 12) continue;
    kept.push(turn);
  }
  return kept.slice(-maxTurns);
}
