import "server-only";

import { runAntiAiV3Pass, type AntiAiV3Lang } from "../anti-ai/anti-ai-v3";

export type AntiAiV5Result = {
  text: string;
  flags: string[];
  passes: number;
};

/**
 * Anti-IA V5 — empile V3 + couches structure / enthousiasme / support.
 */
export function runAntiAiV5Pass(
  text: string,
  lang: AntiAiV3Lang,
  extraBlacklist?: string[],
  opts?: { lastAssistantLine?: string; microSeed?: string },
): AntiAiV5Result {
  const base = runAntiAiV3Pass(text, lang, extraBlacklist, opts);
  let out = base.text;
  const flags = [...base.flags, "anti_ai_v5"];

  out = out.replace(/\b(as\s+an\s+ai|en\s+tant\s+qu['’']?assistant\s+virtuel)\b[^.!?]*[.!?]?/gi, "");
  out = out.replace(/\b(je\s+suis\s+l[àa]\s+pour\s+vous\s+accompagner)\b/gi, "");
  out = out.replace(/\b(ce\s+fut\s+un\s+plaisir\s+de\s+vous\s+aider)\b/gi, "");
  out = out.replace(/\bn['’']h[eé]sitez\s+pas\s+[àa]\s+nous\s+faire\s+confiance\b/gi, "");
  out = out.replace(/\b(i\s+hope\s+this\s+helps|hope\s+this\s+helps)\b[\s.,!?…]*/gi, "");

  if ((out.match(/\!/g) ?? []).length >= 3) {
    out = out.replace(/!/g, (x, i) => (i === 0 ? x : "."));
    flags.push("deflated_exclaim_stack");
  }

  out = out.replace(/\s{2,}/g, " ").trim();
  return { text: out, flags: [...new Set(flags)], passes: base.passes + 1 };
}
