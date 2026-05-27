import { detectConversationLanguage, type ConversationLanguage } from "@/lib/ai/language-detection";

export type LockedLanguage = ConversationLanguage;

/** Langue verrouillée pour tout le fil (message prospect prime). */
export function lockConversationLanguage(args: {
  lastUserMessage: string;
  stateLanguage?: LockedLanguage;
  history?: Array<{ role: string; content: string }>;
}): LockedLanguage {
  return detectConversationLanguage({
    message: args.lastUserMessage,
    previous: args.stateLanguage,
    history: args.history?.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  });
}

const FR_MARKERS = /\b(vous|nous|monsieur|madame|bonjour|merci|où|ou|êtes|etes|situer|douala|livraison|prix|combien)\b/i;
const EN_MARKERS = /\b(we\s+are|you\s+are|sir|madam|good\s+afternoon|located|how\s+can\s+i|thank\s+you)\b/i;
const ES_MARKERS = /\b(estamos|usted|señor|señora|buenos|gracias|dónde|donde|ubicad)\b/i;

function sentenceLanguageGuess(s: string): LockedLanguage | "mixed" {
  const t = String(s ?? "").trim();
  if (!t) return "mixed";
  const fr = FR_MARKERS.test(t);
  const en = EN_MARKERS.test(t);
  const es = ES_MARKERS.test(t);
  const hits = [fr, en, es].filter(Boolean).length;
  if (hits > 1) return "mixed";
  if (fr) return "fr";
  if (en) return "en";
  if (es) return "es";
  return "mixed";
}

/** Supprime les phrases dans une langue différente de la langue verrouillée. */
export function stripForeignLanguageSentences(text: string, locked: LockedLanguage): string {
  const sentences = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) {
    const guess = sentenceLanguageGuess(text);
    if (guess !== "mixed" && guess !== locked) return "";
    return text.trim();
  }

  const kept = sentences.filter((s) => {
    const g = sentenceLanguageGuess(s);
    if (g === "mixed") return true;
    return g === locked;
  });

  return kept.join(" ").trim();
}

export function looksWrongLanguage(reply: string, locked: LockedLanguage): boolean {
  const guess = sentenceLanguageGuess(reply);
  return guess !== "mixed" && guess !== locked;
}
