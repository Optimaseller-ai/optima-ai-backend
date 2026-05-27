import "server-only";

import { auditRealismV2, repairRealismV2, type RealismV2Lang } from "../realism-score-v2";

export type RealismV5Audit = { score: number; flags: string[] };

function flag(a: RealismV5Audit, name: string, p = 12) {
  a.flags.push(name);
  a.score = Math.max(0, a.score - p);
}

export function auditRealismV5(text: string): RealismV5Audit {
  const base = auditRealismV2(text);
  const a: RealismV5Audit = { score: base.score, flags: [...base.flags] };

  const t = String(text ?? "").trim();
  if (!t) return a;

  if (/\b(ai|intelligence artificielle|as\s+an\s+assistant|en\s+tant\s+qu['’']?ia)\b/i.test(t)) flag(a, "meta_ai", 22);
  if (/\b(cependant|toutefois|néanmoins|however|nevertheless)\b.*\b(cependant|however)\b/i.test(t)) flag(a, "double_connector", 8);
  if (/\b(best\s+regards|cordialement\s*,\s*$|kind\s+regards)\b/i.test(t)) flag(a, "email_closing", 10);
  if (/\b(permettez[- ]moi\s+de|allow\s+me\s+to)\b/i.test(t)) flag(a, "formal_corp", 9);
  return a;
}

/** Réécriture humaine downstream (conservatrice). */
export function repairRealismV5(text: string, lang: RealismV2Lang): string {
  let out = repairRealismV2(text, lang);
  out = out.replace(/\b(en\s+tant\s+qu['’']?ia|as\s+an\s+assistant)\b[^.!?]*[.!?]?/gi, "");
  out = out.replace(/\b(kind\s+regards|best\s+regards|cordialement)\b[\s,]*/gi, "");
  out = out.replace(/\b(permettez[- ]moi\s+de)\b[^.!?]*(?:[.]|(?=\s))?/gi, "");
  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}
