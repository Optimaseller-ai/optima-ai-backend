import "server-only";

const MIN_HUMAN_REPLY_SCORE = 0.35;
const WORD_RE = /[a-zàâäéèêëïîôùûüç]{2,}/gi;
const PUNCTUATION_ONLY = /^[\s.!?…,;:'"«»\-–—?？]+$/u;
const EMOJI_ONLY_LINE =
  /^[\s\p{Extended_Pictographic}\u200d\ufe0f]+$/u;

const SHORT_VALID_FR =
  /^(salut|cc|hey|bonjour|bonsoir|oui|non|ok|merci|d'accord|ça marche|ca marche|je vois|bien reçu|bien recu)\b/i;

export type HumanReplyValidation = {
  valid: boolean;
  humanReplyScore: number;
  reason: string;
  emojiOnly: boolean;
};

function normalize(reply: string): string {
  return String(reply ?? "").replace(/\s+/g, " ").trim();
}

function stripEmojiAndPunct(text: string): string {
  return String(text ?? "")
    .replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMeaningfulWords(text: string): number {
  const core = stripEmojiAndPunct(text);
  if (!core) return 0;
  return core.match(WORD_RE)?.length ?? 0;
}

export function isEmojiOnlyReply(reply: string): boolean {
  const raw = normalize(reply);
  if (!raw) return true;
  if (EMOJI_ONLY_LINE.test(raw)) return true;
  const core = stripEmojiAndPunct(raw);
  if (!core) return true;
  return countMeaningfulWords(raw) < 1;
}

export function containsHumanText(reply: string): boolean {
  return computeHumanReplyScore(reply) >= MIN_HUMAN_REPLY_SCORE;
}

export function computeHumanReplyScore(reply: string): number {
  const raw = normalize(reply);
  if (!raw) return 0;
  if (PUNCTUATION_ONLY.test(raw)) return 0;
  if (EMOJI_ONLY_LINE.test(raw)) return 0;

  const usefulLen = stripEmojiAndPunct(raw).length;
  if (usefulLen < 2) return 0;

  const words = countMeaningfulWords(raw);
  if (isEmojiOnlyReply(raw)) return 0;

  let score = 0;
  if (words >= 2) {
    score = 0.55 + Math.min(0.35, usefulLen / 40);
  } else if (words === 1) {
    score = usefulLen >= 5 ? 0.52 : usefulLen >= 3 ? 0.42 : 0.28;
  } else {
    score = Math.min(0.2, usefulLen / 20);
  }

  if (/[\p{Extended_Pictographic}]/u.test(raw) && words >= 1) {
    score += 0.08;
  }

  if (SHORT_VALID_FR.test(stripEmojiAndPunct(raw))) {
    score = Math.max(score, 0.48);
  }

  return Number(Math.min(1, score).toFixed(3));
}

export function isValidHumanReply(reply: string): boolean {
  return computeHumanReplyScore(reply) >= MIN_HUMAN_REPLY_SCORE;
}

export function validateHumanReply(reply: string): HumanReplyValidation {
  const text = normalize(reply);
  const emojiOnly = isEmojiOnlyReply(text);
  const humanReplyScore = computeHumanReplyScore(text);
  const valid = humanReplyScore >= MIN_HUMAN_REPLY_SCORE && text.length > 0;

  let reason = "ok";
  if (!text) reason = "empty";
  else if (PUNCTUATION_ONLY.test(text)) reason = "punctuation_only";
  else if (emojiOnly) reason = "emoji_only";
  else if (humanReplyScore < MIN_HUMAN_REPLY_SCORE) reason = "score_below_threshold";

  return { valid, humanReplyScore, reason, emojiOnly };
}

export const HUMAN_REPLY_REGEN_HINT_FR =
  "Réponds comme un humain réel. Interdiction réponse emoji seule. Réponse courte naturelle obligatoire.";

export { MIN_HUMAN_REPLY_SCORE };
