import type { ResponsePrimaryIntent } from "./response-intent";

const SMALL_TALK_PATTERNS: RegExp[] = [
  /\bhow'?s\s+your\s+day\b/i,
  /\bhow\s+is\s+your\s+day\b/i,
  /\bcomment\s+se\s+passe\s+(votre|ta)\s+journ(ée|e)\b/i,
  /\bcomment\s+va\s+(votre|ta)\s+journ(ée|e)\b/i,
  /\bque\s+puis[- ]je\s+faire\s+pour\s+vous\b/i,
  /\bcomment\s+puis[- ]je\s+vous\s+aider\b/i,
  /\bhow\s+can\s+i\s+help\b/i,
  /\bhow\s+may\s+i\s+assist\b/i,
  /\bwhat\s+can\s+i\s+do\s+for\s+you\b/i,
  /\bavez[- ]vous\s+besoin\s+d['’]?autre\s+chose\b/i,
  /\bfeel\s+free\s+to\b/i,
  /\bn['’]?hésitez\s+pas\b/i,
  /\bje\s+suis\s+ravi[e]?\s+de\b/i,
  /\benchant[eé]\b/i,
  /\bque\s+recherchez[- ]vous\b/i,
  /\bwhat\s+are\s+you\s+looking\s+for\b/i,
];

const AUTO_QUESTION_END = /\?\s*$/;

export function stripSmallTalkSentences(sentences: string[], intent: ResponsePrimaryIntent): string[] {
  const blockSmallTalk =
    intent === "location" ||
    intent === "price" ||
    intent === "product" ||
    intent === "delivery" ||
    intent === "thanks";

  if (!blockSmallTalk) return sentences;

  return sentences.filter((s) => {
    const t = String(s ?? "").trim();
    if (!t) return false;
    if (SMALL_TALK_PATTERNS.some((re) => re.test(t))) return false;
    if (AUTO_QUESTION_END.test(t) && intent === "location") {
      if (/\b(help|aider|model|modèle|looking\s+for|recherchez)\b/i.test(t)) return false;
    }
    return true;
  });
}

export function stripOverTalking(text: string, intent: ResponsePrimaryIntent): string {
  const sentences = String(text ?? "")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!sentences.length) return String(text ?? "").trim();

  let out = stripSmallTalkSentences(sentences, intent);
  if (intent === "location" || intent === "thanks") {
    out = out.slice(0, 2);
  }
  return out.join(" ").trim();
}
