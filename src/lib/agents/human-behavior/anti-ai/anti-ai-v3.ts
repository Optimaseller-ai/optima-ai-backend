import "server-only";

import { auditConversationRealism, repairConversationRealism } from "@/lib/agents/human-behavior/conversation-realism";
import { auditHumanRealism, repairAdvancedHumanRealism, repairHumanRealism } from "@/lib/agents/human-behavior/human-realism-score";
import { repairEmotionalRealism } from "@/lib/agents/human-behavior/emotional-realism";
import { auditRealismV2, repairRealismV2 } from "@/lib/agents/human-behavior/realism-score-v2";
import { applyDigitalImperfections } from "@/lib/agents/human-behavior/digital-imperfections";
import { stripRepeatedMicroReaction } from "@/lib/agents/human-behavior/social-micro-reactions";
import { runAntiAiFilterPass } from "./anti-ai-filter";

export type AntiAiV3Lang = "fr" | "en" | "es";

export type AntiAiV3Result = {
  text: string;
  flags: string[];
  passes: number;
};

/**
 * Filtre anti-IA niveau 10 — détection structure ChatGPT + réécriture humaine.
 */
export function runAntiAiV3Pass(
  text: string,
  lang: AntiAiV3Lang,
  extraBlacklist?: string[],
  opts?: { lastAssistantLine?: string; microSeed?: string },
): AntiAiV3Result {
  const flags: string[] = [];
  let out = String(text ?? "").trim();
  if (!out) return { text: out, flags, passes: 0 };

  const base = runAntiAiFilterPass(out, extraBlacklist);
  out = base.text;
  if (base.removedPhraseHits) flags.push("blacklist_hits");

  const h1 = auditHumanRealism(out);
  const c1 = auditConversationRealism(out);
  const v2 = auditRealismV2(out);
  flags.push(...h1.flags, ...c1.flags, ...v2.flags);

  out = repairHumanRealism(out, lang);
  out = repairAdvancedHumanRealism(out, lang);
  out = repairConversationRealism(out, lang);
  out = repairEmotionalRealism(out, lang);
  out = repairRealismV2(out, lang);
  out = stripRepeatedMicroReaction(out, opts?.lastAssistantLine);
  out = applyDigitalImperfections(out, opts?.microSeed ?? out);

  out = out.replace(/\b(je\s+suis\s+ravi\s+de\s+vous\s+aider|i\s*'?\s*m\s+delighted\s+to\s+help)\b[\s.,!?…]*/gi, "");
  out = out.replace(/\b(avec\s+plaisir\s*!|happy\s+to\s+help\s*!)\b/gi, lang === "fr" ? "D’accord." : "Alright.");
  out = out.replace(/\b(n'hésitez\s+pas\s+à\s+nous\s+contacter|don't\s+hesitate\s+to\s+contact\s+us)\b[\s.,!?…]*/gi, "");

  out = out.replace(/\s{2,}/g, " ").trim();

  return { text: out, flags: [...new Set(flags)], passes: 6 };
}
