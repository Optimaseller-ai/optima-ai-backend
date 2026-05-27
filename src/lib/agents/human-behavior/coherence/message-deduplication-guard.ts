/**
 * Garde anti-répétition : une réponse cohérente — pas de phrase complète suivie de morceaux dupliqués.
 */

import {
  dedupeBubbles,
  dedupeSentences,
  normalizeForDedupe,
  sentenceSimilarity,
  splitIntoSentences,
} from "./duplicate-detector";

function tokenOverlapRatio(smallerNorm: string, largerNorm: string): number {
  const words = smallerNorm.split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return 0;
  let hit = 0;
  for (const w of words) {
    if (largerNorm.includes(w)) hit += 1;
  }
  return hit / words.length;
}

/** Supprime phrases / paragraphes dupliqués dans le brut modèle (double envoi dans un seul bloc). */
export function sanitizeAssistantReplyText(text: string): string {
  const t = String(text ?? "").trim();
  if (!t) return t;

  const paragraphs = t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  let body: string;
  if (paragraphs.length >= 2) {
    const dp = dedupeBubbles(paragraphs, 0.52);
    body = dp.join("\n\n").trim();
  } else {
    body = t;
  }

  const parts = splitIntoSentences(body);
  const d = dedupeSentences(parts, 0.62);
  return d.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Après découpe UI : enlève bulles qui répètent une partie déjà présente ( sous-chaîne / fort recouvrement ).
 */
export function dedupeAssistantMessageBubbles(bubbles: string[]): string[] {
  let b = bubbles.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (b.length <= 1) return b;

  b = dedupeBubbles(b, 0.58);

  const out: string[] = [];
  let accNorm = "";

  for (const chunk of b) {
    const cNorm = normalizeForDedupe(chunk);
    if (cNorm.length < 4) continue;

    if (accNorm) {
      if (accNorm.includes(cNorm)) continue;
      if (cNorm.includes(accNorm) && accNorm.length + 12 <= cNorm.length) {
        out.length = 0;
        out.push(chunk);
        accNorm = cNorm;
        continue;
      }
      const ov = tokenOverlapRatio(cNorm, accNorm);
      if (ov >= 0.74 && chunk.length < 120) continue;
    }

    let nearDup = false;
    for (const prev of out) {
      if (sentenceSimilarity(prev, chunk) >= 0.7) {
        nearDup = true;
        break;
      }
    }
    if (nearDup) continue;

    out.push(chunk);
    accNorm = accNorm ? `${accNorm} ${cNorm}` : cNorm;
  }

  if (!out.length && b[0]) return [b[0]];
  return out;
}

/** Si tout le contenu tient essentiellement dans la première bulle, évite les envois fragmentés redondants. */
export function collapseRedundantBubbleSplit(bubbles: string[]): string[] {
  const b = dedupeAssistantMessageBubbles(bubbles);
  if (b.length <= 2) return b;
  const first = b[0]!;
  const fn = normalizeForDedupe(first);
  let redundantTail = 0;
  for (let i = 1; i < b.length; i++) {
    const ni = normalizeForDedupe(b[i]!);
    if (!ni) continue;
    if (fn.includes(ni) || tokenOverlapRatio(ni, fn) >= 0.8) redundantTail += 1;
  }
  if (redundantTail >= b.length - 1) {
    const joined = b.join(" ").replace(/\s+/g, " ").trim();
    return joined.length ? [joined] : b;
  }
  return b;
}
