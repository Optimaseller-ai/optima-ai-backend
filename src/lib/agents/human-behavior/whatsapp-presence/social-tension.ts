import {
  detectSocialTension,
  formatSocialTensionPromptBlock,
  type SocialTensionKind,
} from "@/lib/agents/human-behavior/social-tension-detector";

export type { SocialTensionKind };

/** Détection tension sociale L19 — inclut impatience explicite. */
export function detectWhatsAppSocialTension(message: string): SocialTensionKind {
  const base = detectSocialTension(message);
  if (base !== "none") return base;

  const low = String(message ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (/\b(vite|dépêche|trop\s+long|j\s*attends|still\s+waiting|hurry|combien\s+de\s+temps)\b/i.test(low)) {
    return "irritation";
  }
  if (/\b(impatient|impatience|ça\s+fait\s+longtemps)\b/i.test(low)) {
    return "irritation";
  }

  return "none";
}

export function formatWhatsAppSocialTensionBlock(kind: SocialTensionKind, lang: "fr" | "en" | "es"): string | null {
  return formatSocialTensionPromptBlock(kind, lang);
}
