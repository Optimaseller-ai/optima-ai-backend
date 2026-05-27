import "server-only";

const CHATGPT_PATTERNS: RegExp[] = [
  /\b(je\s+comprends\s+(parfaitement|totalement)|je\s+suis\s+là\s+pour\s+vous\s+aider)\b/gi,
  /\b(n'hésitez\s+pas|n'hésite\s+pas\s+à)\b/gi,
  /\b(comment\s+puis[- ]je\s+vous\s+aider)\b/gi,
  /\b(je\s+serais\s+ravi[e]?\s+de)\b/gi,
  /\b(merci\s+pour\s+votre\s+(message|question))\b/gi,
  /\b(en\s+tant\s+que\s+(assistant|conseiller\s+virtuel))\b/gi,
  /\b(i\s+understand\s+your\s+concern|how\s+may\s+i\s+assist)\b/gi,
  /\b(feel\s+free\s+to)\b/gi,
];

const SUPPORT_TONE: RegExp[] = [
  /\b(notre\s+équipe\s+est\s+à\s+votre\s+disposition)\b/gi,
  /\b(service\s+client|support\s+technique)\b/gi,
  /\b(ticket|numéro\s+de\s+dossier)\b/gi,
];

export function applyWhatsAppRealismFilter(text: string): { text: string; fixes: number } {
  let out = String(text ?? "").trim();
  let fixes = 0;

  for (const re of [...CHATGPT_PATTERNS, ...SUPPORT_TONE]) {
    if (re.test(out)) {
      out = out.replace(re, "").replace(/\s{2,}/g, " ").trim();
      fixes += 1;
    }
    re.lastIndex = 0;
  }

  out = out.replace(/^[—–-]\s+/gm, "").trim();
  return { text: out, fixes };
}
