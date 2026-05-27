import "server-only";

import {
  dedupeAssistantMessageBubbles,
  sanitizeAssistantReplyText,
} from "@/lib/agents/human-behavior/coherence/message-deduplication-guard";
import { collapseRedundantBubbleSplit } from "@/lib/agents/human-behavior/coherence/message-deduplication-guard";
import { normalizeForDedupe } from "@/lib/agents/human-behavior/coherence/duplicate-detector";

function norm(s: string): string {
  return normalizeForDedupe(String(s ?? ""));
}

/** Bloque doublons intra-réponse, vs historique récent, et multi-bulles spam. */
export function applyDuplicationShieldV3(args: {
  text: string;
  messagePlan: string[];
  recentAssistantMessages?: string[];
  /** Tour social / salutation — ne pas vider la réponse sur similarité faible. */
  socialOnlyMode?: boolean;
}): { text: string; messagePlan: string[]; strippedDuplicates: number } {
  let stripped = 0;
  let text = sanitizeAssistantReplyText(String(args.text ?? "").trim());
  let plan = args.messagePlan.length ? [...args.messagePlan] : [text];

  const recentNorm = (args.recentAssistantMessages ?? [])
    .map((m) => norm(m))
    .filter((n) => n.length > 8);

  if (recentNorm.length && !args.socialOnlyMode) {
    const tNorm = norm(text);
    for (const prev of recentNorm) {
      if (tNorm === prev || (tNorm.length > 24 && prev.includes(tNorm))) {
        stripped += 1;
        text = "";
        plan = [];
        break;
      }
      if (prev.includes(tNorm) && tNorm.length >= 18) {
        stripped += 1;
        text = "";
        plan = [];
        break;
      }
    }
  }

  if (!text) return { text: "", messagePlan: [], strippedDuplicates: stripped };

  plan = plan.map((b) => sanitizeAssistantReplyText(b)).filter(Boolean);
  plan = dedupeAssistantMessageBubbles(plan);
  plan = collapseRedundantBubbleSplit(plan);

  if (plan.length > 3) {
    stripped += plan.length - 3;
    plan = plan.slice(0, 3);
  }

  if (plan.length > 1) {
    const microSpam = plan.filter((b) => b.length <= 12).length;
    if (microSpam >= 2 && plan.every((b) => b.length < 40)) {
      text = plan.join(" ").replace(/\s+/g, " ").trim();
      plan = [text];
      stripped += 1;
    }
  }

  text = plan.length ? plan.join("\n\n") : text;
  return { text, messagePlan: plan.length ? plan : [text], strippedDuplicates: stripped };
}
