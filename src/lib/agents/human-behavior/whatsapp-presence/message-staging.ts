import "server-only";

import { maybeSplitAssistantMessage } from "@/lib/agents/human-behavior/conversation/message-splitting";
import { dedupeAssistantMessageBubbles } from "@/lib/agents/human-behavior/coherence/message-deduplication-guard";

/** Découpe WhatsApp logique : courts messages OK, pas de spam ni incohérence. */
export function stageWhatsAppMessages(args: {
  text: string;
  microSeed: string;
  maxBubbles?: 1 | 2 | 3;
}): string[] {
  const raw = String(args.text ?? "").trim();
  if (!raw) return [];

  const max = args.maxBubbles ?? 2;
  const wordCount = raw.split(/\s+/).filter(Boolean).length;

  if (wordCount <= 14 && raw.length < 95) return [raw];

  const productLookup = /\b(je\s+regarde|je\s+vérifie|stock|dispo|modèle|model)\b/i.test(raw);
  const budget = productLookup && raw.length > 100 ? (Math.min(3, max) as 1 | 2 | 3) : (Math.min(2, max) as 1 | 2);

  let plan = maybeSplitAssistantMessage(raw, args.microSeed, budget);
  plan = dedupeAssistantMessageBubbles(plan);

  if (plan.length > max) plan = plan.slice(0, max);

  if (plan.length >= 2) {
    const allTiny = plan.every((b) => b.length < 22);
    if (allTiny) return [plan.join(" ").replace(/\s+/g, " ").trim()];
  }

  return plan.length ? plan : [raw];
}
