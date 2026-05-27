/**
 * Mémoire FAQ — questions fréquentes + réponses validées (in-memory, extensible Supabase).
 */

import type { BusinessFaqEntry } from "./types";

export type ValidatedFaqEntry = {
  id: string;
  questionNormalized: string;
  questionDisplay: string;
  answerValidated: string;
  hitCount: number;
  lastUsedAt: string;
  source: "human_validated" | "supervisor" | "import" | "admin_catalog";
};

const faqByTenant = new Map<string, ValidatedFaqEntry[]>();
const MAX_ENTRIES_PER_TENANT = 200;

function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeQuestion(text)
      .split(" ")
      .filter((t) => t.length >= 3),
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

export function recordValidatedFaq(args: {
  userId: string;
  question: string;
  answer: string;
  source?: ValidatedFaqEntry["source"];
}): ValidatedFaqEntry {
  const list = faqByTenant.get(args.userId) ?? [];
  const norm = normalizeQuestion(args.question);
  const existing = list.find((e) => e.questionNormalized === norm);
  const now = new Date().toISOString();

  if (existing) {
    existing.answerValidated = args.answer.trim();
    existing.hitCount += 1;
    existing.lastUsedAt = now;
    return existing;
  }

  const entry: ValidatedFaqEntry = {
    id: `faq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    questionNormalized: norm,
    questionDisplay: args.question.trim(),
    answerValidated: args.answer.trim(),
    hitCount: 1,
    lastUsedAt: now,
    source: args.source ?? "human_validated",
  };

  list.unshift(entry);
  if (list.length > MAX_ENTRIES_PER_TENANT) list.pop();
  faqByTenant.set(args.userId, list);
  return entry;
}

export function getRelevantValidatedFaqs(userId: string, prospectMessage: string, limit = 2): ValidatedFaqEntry[] {
  const list = faqByTenant.get(userId) ?? [];
  if (!list.length) return [];

  const msgTokens = tokenSet(prospectMessage);
  if (!msgTokens.size) return list.slice(0, limit);

  return [...list]
    .map((e) => ({ e, score: overlapScore(msgTokens, tokenSet(e.questionDisplay)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.e.hitCount - a.e.hitCount)
    .slice(0, limit)
    .map((x) => x.e);
}

export function formatBusinessFaqEntriesSlice(entries: BusinessFaqEntry[], lang: "fr" | "en" | "es"): string {
  if (!entries.length) return "";
  const header =
    lang === "en"
      ? "BUSINESS FAQ (admin — cite faithfully):"
      : lang === "es"
        ? "FAQ NEGOCIO (admin):"
        : "FAQ ENTREPRISE (admin — citer fidèlement) :";
  const lines = entries.map(
    (e) => `- [${e.category}] Q: ${e.question.slice(0, 140)}\n  R: ${e.answer.slice(0, 450)}`,
  );
  return [header, ...lines].join("\n");
}

export function formatFaqMemorySlice(
  entries: ValidatedFaqEntry[],
  lang: "fr" | "en" | "es",
): string {
  if (!entries.length) return "";
  const header =
    lang === "en"
      ? "VALIDATED FAQ (cite faithfully — do not extend):"
      : lang === "es"
        ? "FAQ VALIDADA:"
        : "FAQ VALIDÉE (citer fidèlement — ne pas extrapoler) :";

  const lines = entries.map(
    (e) => `- Q: ${e.questionDisplay.slice(0, 120)}\n  R: ${e.answerValidated.slice(0, 400)}`,
  );
  return [header, ...lines].join("\n");
}

/** Sync mémoire session depuis entrées Supabase (après search). */
export function hydrateValidatedFaqFromDb(userId: string, entries: BusinessFaqEntry[]): void {
  for (const e of entries) {
    recordValidatedFaq({
      userId,
      question: e.question,
      answer: e.answer,
      source: "import",
    });
  }
}
