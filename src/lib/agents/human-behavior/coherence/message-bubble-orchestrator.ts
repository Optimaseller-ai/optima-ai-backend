import { dedupeBubbles } from "./duplicate-detector";
import { collapseRedundantBubbleSplit, dedupeAssistantMessageBubbles } from "./message-deduplication-guard";
import { intentMaxBubbles, type ResponsePrimaryIntent } from "./response-intent";

/**
 * Plan de bulles cohérent — pas de pluie de messages IA désynchronisés.
 */
export function orchestrateMessageBubbles(args: {
  text: string;
  intent: ResponsePrimaryIntent;
  rushed?: boolean;
  /** Ne pas découper au-delà de N bulles pour ce tour. */
  maxBubbles?: number;
}): string[] {
  const raw = String(args.text ?? "").trim();
  if (!raw) return [];

  const cap = Math.min(args.maxBubbles ?? intentMaxBubbles(args.intent), intentMaxBubbles(args.intent));
  if (cap <= 1 || args.rushed) return [raw];

  const byLines = raw
    .split(/\n{2,}|\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  let bubbles =
    byLines.length >= 2
      ? byLines
      : raw
          .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Ý"“])/g)
          .map((s) => s.trim())
          .filter(Boolean);

  bubbles = dedupeBubbles(bubbles);
  bubbles = dedupeAssistantMessageBubbles(bubbles);
  bubbles = collapseRedundantBubbleSplit(bubbles);

  if (bubbles.length > cap) {
    if (cap === 1) return [bubbles.join(" ").replace(/\s+/g, " ").trim()];
    return [bubbles[0]!, bubbles.slice(1).join(" ").trim()].filter(Boolean);
  }

  return bubbles.length ? bubbles : [raw];
}
