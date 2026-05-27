/**
 * Intelligence sociale subconsciente — sous-entendus, gêne, sarcasme, intérêt implicite.
 */

export type SocialIntelCue =
  | "sarcasm"
  | "awkwardness"
  | "hidden_hesitation"
  | "hidden_frustration"
  | "social_fatigue"
  | "implicit_interest"
  | "implicit_refusal"
  | "testing_agent";

export type SocialIntelResult = {
  cues: SocialIntelCue[];
};

function normLower(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function analyzeSocialIntelligence(message: string): SocialIntelResult {
  const t = normLower(message);
  const cues: SocialIntelCue[] = [];
  if (!t) return { cues };

  if (/\b(mdr|lol|haha|😂|ah\s+bon|ben\s+oui|super\s+quoi)\b/i.test(t)) cues.push("sarcasm");
  if (/\b(gên|gene|mal\s+à\s+l|awkward|incómodo|désolé\s+de\s+déranger)\b/i.test(t)) cues.push("awkwardness");
  if (/\b(peut[- ]être|je\s+sais\s+pas|pas\s+sûr|on\s+verra|hmm+)\b/i.test(t) && t.length < 120) cues.push("hidden_hesitation");
  if (/\b(franchement|honnêtement|sans\s+mentir).*(pas\s+content|déçu|marre)/i.test(t)) cues.push("hidden_frustration");
  if (/\b(fatigu|crevé|creve|épuis|lassé|las)\b/i.test(t)) cues.push("social_fatigue");
  if (/\b(intéress|curieux|curieuse|ça\s+m['’']?intéresse|tell\s+me\s+more)\b/i.test(t)) cues.push("implicit_interest");
  if (/\b(pas\s+maintenant|plus\s+tard|laisse\s+tomber|forget\s+it|non\s+merci)\b/i.test(t)) cues.push("implicit_refusal");
  if (/\b(tu\s+es\s+un\s+robot|c['’']est\s+une\s+ia|chatgpt|tu\s+comprends\s+quoi)\b/i.test(t)) cues.push("testing_agent");

  return { cues: [...new Set(cues)] };
}

export function formatSocialIntelligencePromptBlock(result: SocialIntelResult, lang: "fr" | "en" | "es"): string | null {
  if (!result.cues.length) return null;
  const list = result.cues.join(", ");
  if (lang === "en") {
    return [
      `SUBCONSCIOUS SOCIAL READ (${list}):`,
      "- Read between the lines; respond to what they imply, not only literal words.",
      "- Never lecture them about what you detected; adjust tone quietly.",
    ].join("\n");
  }
  if (lang === "es") {
    return `INTELIGENCIA SOCIAL (${list}): lea entre líneas; ajuste sin explicar.`;
  }
  return [
    `INTELLIGENCE SOCIALE SUBCONSCIENTE (${list}):`,
    "- Comprendre sous-entendus / gêne / sarcasme / fatigue / intérêt ou refus implicite — sans le nommer au prospect.",
    "- Ajuster ton et longueur en douceur ; jamais « je comprends parfaitement ».",
  ].join("\n");
}
