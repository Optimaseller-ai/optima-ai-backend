/**
 * Malaise social — irritation, méfiance, fatigue fil → adoucir.
 */

import { detectSocialTension } from "@/lib/agents/human-behavior/social-tension-detector";
import { inferConversationEmotionalTemperature } from "@/lib/agents/human-behavior/emotions/conversation-emotion";

export type SocialDiscomfortKind = "none" | "unease" | "irritation" | "mistrust" | "conversation_fatigue";

export function detectSocialDiscomfort(args: {
  message: string;
  fatigue01?: number;
  turnCount?: number;
}): SocialDiscomfortKind {
  const m = String(args.message ?? "").trim();
  const fatigue = args.fatigue01 ?? 0;
  const turns = args.turnCount ?? 0;
  if (fatigue >= 0.6 || turns >= 16) return "conversation_fatigue";

  const temp = inferConversationEmotionalTemperature(m);
  const tension = detectSocialTension(m);
  if (temp === "irrité" || tension === "irritation") return "irritation";
  if (tension === "skepticism") return "mistrust";
  if (tension === "fatigue" || tension === "sarcasm") return "unease";
  if (temp === "frustré") return "irritation";
  if (/\b(gên|gene|mal\s+à\s+l['’']?aise|awkward|incómodo)\b/i.test(m)) return "unease";

  return "none";
}

export function formatSocialDiscomfortPromptBlock(kind: SocialDiscomfortKind, lang: "fr" | "en" | "es"): string | null {
  if (kind === "none") return null;
  if (lang === "en") {
    const m: Record<Exclude<SocialDiscomfortKind, "none">, string> = {
      unease: "SOCIAL DISCOMFORT: awkward vibe — soften, shorter, no pressure.",
      irritation: "SOCIAL DISCOMFORT: irritation — calm, dignified, very brief.",
      mistrust: "SOCIAL DISCOMFORT: mistrust — acknowledge like a human, then facts; no corporate empathy.",
      conversation_fatigue: "SOCIAL DISCOMFORT: long thread fatigue — concise, gentle, no new sales push.",
    };
    return m[kind];
  }
  if (lang === "es") {
    return `MALESTAR SOCIAL (${kind}): suavice y acorte.`;
  }
  const m: Record<Exclude<SocialDiscomfortKind, "none">, string> = {
    unease: "MALAISE SOCIAL : gêne possible — adoucir, raccourcir, zéro pression.",
    irritation: "MALAISE SOCIAL : irritation — calme, digne, très bref.",
    mistrust: "MALAISE SOCIAL : méfiance — accuser réception humaine puis fait utile.",
    conversation_fatigue: "MALAISE SOCIAL : fatigue de fil — plus concis, doux, pas de nouvelle poussée commerciale.",
  };
  return m[kind];
}
