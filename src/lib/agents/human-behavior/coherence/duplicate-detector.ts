/**
 * Détection et fusion des répétitions (phrases, sens, salutations).
 */

function normKey(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Export — garde anti-répétition bulles / sous-chaînes. */
export function normalizeForDedupe(s: string): string {
  return normKey(s);
}

function tokenSet(s: string): Set<string> {
  return new Set(normKey(s).split(" ").filter((w) => w.length > 2));
}

/** Jaccard simple entre deux phrases. */
export function sentenceSimilarity(a: string, b: string): number {
  const ka = normKey(a);
  const kb = normKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  if (ka.includes(kb) || kb.includes(ka)) return 0.92;

  const sa = tokenSet(ka);
  const sb = tokenSet(kb);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 0;
}

export function splitIntoSentences(text: string): string[] {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const parts = t
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?…])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [t];
}

export function dedupeSentences(sentences: string[], threshold = 0.72): string[] {
  const out: string[] = [];
  for (const s of sentences) {
    const cur = String(s ?? "").trim();
    if (!cur) continue;
    const dup = out.some((prev) => sentenceSimilarity(prev, cur) >= threshold);
    if (!dup) out.push(cur);
  }
  return out;
}

export function dedupeBubbles(bubbles: string[], threshold = 0.68): string[] {
  const out: string[] = [];
  for (const b of bubbles) {
    const cur = String(b ?? "").trim();
    if (!cur) continue;
    const dup = out.some((prev) => sentenceSimilarity(prev, cur) >= threshold);
    if (!dup) out.push(cur);
  }
  return out;
}

const GREETING_FRAGMENT =
  /^(good\s+(morning|afternoon|evening)|hello|hi|hey|bonjour|bonsoir|salut|bjr|bsr|coucou|hola|buenos)\b/i;

export function isGreetingFragment(sentence: string): boolean {
  return GREETING_FRAGMENT.test(String(sentence ?? "").trim());
}

export function dedupeGreetingFragments(sentences: string[], greetingAlreadyDone: boolean): string[] {
  if (!greetingAlreadyDone) return sentences;
  return sentences.filter((s) => !isGreetingFragment(s));
}
