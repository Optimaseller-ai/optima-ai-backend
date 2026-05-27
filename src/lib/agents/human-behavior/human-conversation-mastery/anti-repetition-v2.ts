import "server-only";

import { sentenceSimilarity, splitIntoSentences } from "../coherence/duplicate-detector";

function normGreeting(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/^(bonjour|bonsoir|salut|hello|hi|hey|good\s+(morning|afternoon|evening))\b[^.!?]*[.!?]?\s*/i, "")
    .trim();
}

/**
 * Évite de rejouer la même structure / salut que le dernier message assistant.
 */
export function stripAntiRepetitionV2(args: {
  reply: string;
  recentAssistantMessages?: string[];
  microSeed?: string;
}): string {
  let t = String(args.reply ?? "").trim();
  if (!t) return t;

  const prev = (args.recentAssistantMessages ?? []).map((x) => String(x ?? "").trim()).filter(Boolean);
  if (!prev.length) return t;

  const lastPrev = prev[prev.length - 1]!;
  const sentences = splitIntoSentences(t);
  const kept: string[] = [];

  for (const sent of sentences) {
    const sim = sentenceSimilarity(sent, lastPrev);
    if (sim >= 0.78) continue;
    const simAny = prev.some((p) => sentenceSimilarity(sent, p) >= 0.82);
    if (simAny) continue;
    kept.push(sent);
  }

  let out = kept.length ? kept.join(" ").trim() : t;

  const stripped = normGreeting(out);
  const prevStripped = normGreeting(lastPrev);
  if (stripped && prevStripped && sentenceSimilarity(stripped, prevStripped) >= 0.88) {
    out = stripped;
  }

  return out.trim() || t;
}
