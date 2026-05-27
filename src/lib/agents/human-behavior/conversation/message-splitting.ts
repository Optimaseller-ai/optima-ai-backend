import "server-only";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/** Budget de bulles assistant (1 = une seule, 3 = rythme type WhatsApp « je vérifie / stock / taille »). */
export type AssistantBubbleBudget = 1 | 2 | 3;

/** Découpe en phrases fines (., …, !, ?). */
function splitSentences(text: string): string[] {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const parts = t.split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : [t];
}

function collapseChunks(chunks: string[], maxChunks: AssistantBubbleBudget): string[] {
  const m = Math.max(1, Math.min(3, maxChunks));
  if (chunks.length <= m) return chunks;
  if (m === 1) return [chunks.join(" ").replace(/\s+/g, " ").trim()];
  if (m === 2) return [chunks[0]!, chunks.slice(1).join(" ").replace(/\s+/g, " ").trim()].filter(Boolean);
  return chunks.slice(0, 3);
}

/**
 * Découpe parfois un long texte en plusieurs bulles courtes (style employé).
 * `maxChunks` : 3 autorisé pour tours produit (présence humaine / multitâche léger).
 */
export function maybeSplitAssistantMessage(text: string, seed: string, maxChunks: AssistantBubbleBudget = 2): string[] {
  const raw = String(text ?? "").trim();
  const minLen = maxChunks >= 3 ? 105 : 160;
  if (!raw || raw.length < minLen) return [raw];

  const oneLine = raw.replace(/\n+/g, " ").trim();
  const producty = /\b(fcfa|cfa|€)\b/i.test(oneLine);
  const sentences = splitSentences(oneLine);
  if (sentences.length < 2) return [raw];

  const roll = seedHash(seed + raw) % 100;
  const threshold =
    maxChunks >= 3 ? (producty && raw.length > 88 ? 26 : raw.length > 130 ? 32 : 38) : producty && raw.length > 100 ? 14 : 20;
  if (roll >= threshold) return [raw];

  let out: string[];
  if (sentences.length === 2) {
    out = [sentences[0]!, sentences[1]!];
  } else {
    const first = sentences[0]!;
    const last = sentences[sentences.length - 1]!;
    const middle = sentences.slice(1, -1).join(" ").trim();

    if (maxChunks >= 3 && sentences.length >= 3 && middle.length >= 18) {
      out = [first, middle, last].filter((x) => x.length > 0);
    } else if (middle.length >= 24) {
      out = [first, middle, last].filter((x) => x.length > 0);
    } else {
      out = [first, sentences.slice(1).join(" ").trim()].filter((x) => x.length > 0);
    }
  }

  return collapseChunks(out, maxChunks);
}
