import { stripBlacklistedPhrases, stripAssistantMetaLanguage, stripTrailingScriptClosings } from "@/lib/agents/human-behavior/anti-ai/anti-ai-filter";
import { ANTI_AI_PHRASE_BLACKLIST } from "@/lib/agents/human-behavior/anti-ai/phrase-blacklist";

const OVER_POLITE = /\b(veuillez|je vous prie|puis-je avoir l'honneur|with all due respect)\b/gi;
const REPEATED_SORRY = /(désolé|desole|sorry|excuse)/gi;

/** Réduit sur-politesse, excuses répétées, réponses trop parfaites. */
export function balanceHumanBehavior(text: string, recentAssistantMessages?: string[]): {
  text: string;
  adjustments: string[];
} {
  let out = String(text ?? "").trim();
  const adjustments: string[] = [];

  const anti = stripBlacklistedPhrases(out);
  out = anti.text;
  if (anti.removedPhraseHits) adjustments.push("blacklist_phrases");

  out = stripAssistantMetaLanguage(out);
  out = stripTrailingScriptClosings(out);

  const recentSorry = (recentAssistantMessages ?? []).join(" ").match(REPEATED_SORRY)?.length ?? 0;
  if (recentSorry >= 2 && REPEATED_SORRY.test(out)) {
    out = out.replace(REPEATED_SORRY, "").replace(/\s{2,}/g, " ").trim();
    adjustments.push("dedupe_sorry");
  }

  if (OVER_POLITE.test(out)) {
    out = out.replace(OVER_POLITE, "").replace(/\s{2,}/g, " ").trim();
    adjustments.push("soften_over_polite");
  }

  // Réponses trop structurées (listes numérotées longues)
  const numbered = out.match(/^\s*\d+[\.)]/gm) ?? [];
  if (numbered.length >= 3) {
    out = out
      .replace(/^\s*\d+[\.)]\s*/gm, "")
      .split(/\n+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(" ");
    adjustments.push("trim_numbered_list");
  }

  // Imperfection légère : éviter triple adjectif
  out = out.replace(/\b(très\s+){2,}/gi, "très ");

  if (!out.trim()) {
    out = "Oui, je vous explique.";
    adjustments.push("fallback_short");
  }

  return { text: out.trim(), adjustments };
}

export function getPersonalityAntiAiExtras(): string[] {
  return [...ANTI_AI_PHRASE_BLACKLIST.slice(0, 12)];
}
