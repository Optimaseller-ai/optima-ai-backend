import type { LearningMemory, ScoredPhrase } from "./memory/learning-memory-types";

/** Garde-fous — le learning ne doit jamais pousser spam / agressivité / manipulation. */
export type LearningSafetyLimits = {
  maxFollowupsPerDay: number;
  minHoursBetweenFollowups: number;
  blockAggressivePhrases: boolean;
  maxClosingPressureScore: number;
};

export const DEFAULT_LEARNING_SAFETY: LearningSafetyLimits = {
  maxFollowupsPerDay: 2,
  minHoursBetweenFollowups: 4,
  blockAggressivePhrases: true,
  maxClosingPressureScore: 75,
};

const AGGRESSIVE =
  /\b(dernière chance|urgent|vite|maintenant ou jamais|offre expire|garanti|100%|sans faute|tu dois|vous devez)\b/i;

const MANIPULATIVE =
  /\b(ne ratez pas|seulement aujourd'hui|plus que \d+ en stock|dernier exemplaire fictif)\b/i;

export function filterPhraseForSafety(phrase: string, limits = DEFAULT_LEARNING_SAFETY): boolean {
  if (!limits.blockAggressivePhrases) return true;
  const t = String(phrase ?? "");
  if (AGGRESSIVE.test(t) || MANIPULATIVE.test(t)) return false;
  return true;
}

export function sanitizeLearningMemoryForUse(
  memory: LearningMemory,
  limits = DEFAULT_LEARNING_SAFETY,
): LearningMemory {
  const filterList = (list: ScoredPhrase[]) =>
    list.filter((p) => filterPhraseForSafety(p.phrase, limits) && p.score <= limits.maxClosingPressureScore + 25);

  return {
    ...memory,
    topPerformingClosings: filterList(memory.topPerformingClosings),
    effectiveResponses: filterList(memory.effectiveResponses),
    insights: memory.insights.filter((i) => !AGGRESSIVE.test(i.text) && !MANIPULATIVE.test(i.text)),
  };
}

/** Bloc prompt optionnel — suggestions learning, jamais obligatoires. */
export function formatLearningPromptBlock(memory: LearningMemory, lang: "fr" | "en" = "fr"): string | null {
  const safe = sanitizeLearningMemoryForUse(memory);
  if (safe.totalObservations < 5) return null;

  const lines: string[] = [];
  if (lang === "en") {
    lines.push("BUSINESS LEARNING (soft hints only — stay human, never pushy):");
  } else {
    lines.push("APPRENTISSAGE MÉTIER (suggestions légères — rester humain, jamais insistant) :");
  }

  const closing = safe.topPerformingClosings[0];
  if (closing && closing.score >= 55) {
    lines.push(`- Closing qui a bien marché : « ${closing.phrase.slice(0, 80)} »`);
  }
  const style = safe.stylePerformance[0];
  if (style && style.samples >= 3) {
    lines.push(`- Ton efficace sur ce business : ${style.tone}`);
  }
  const hour = [...safe.bestHours].sort((a, b) => b.conversionRate - a.conversionRate)[0];
  if (hour && hour.samples >= 3) {
    lines.push(`- Créneau fort : ${hour.label}`);
  }

  if (lines.length <= 1) return null;
  lines.push("- Ne jamais spammer ni forcer ; le naturel prime sur la conversion.");
  return lines.join("\n");
}
