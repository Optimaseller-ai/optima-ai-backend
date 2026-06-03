const WORD_RE = /[a-zàâäéèêëïîôùûüç]{2,}/gi;

function stripEmojiAndPunct(text: string): string {
  return String(text ?? "")
    .replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countMeaningfulWords(text: string): number {
  const core = stripEmojiAndPunct(text);
  if (!core) return 0;
  const matches = core.match(WORD_RE);
  return matches?.length ?? 0;
}

export function isEmojiOnlyReply(text: string): boolean {
  const raw = String(text ?? "").trim();
  if (!raw) return true;
  const withoutEmoji = stripEmojiAndPunct(raw);
  if (!withoutEmoji) return true;
  return countMeaningfulWords(raw) < 2;
}

export const EMOJI_ONLY_REGEN_HINT =
  "Reply naturally with short human text, not emoji only.";
