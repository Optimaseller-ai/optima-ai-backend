/**
 * « Langage corporel » numérique — rythme, pauses, énergie (prompt + client).
 */

export type DigitalBodyLang = "fr" | "en" | "es";

export function formatDigitalBodyLanguagePromptBlock(lang: DigitalBodyLang): string {
  if (lang === "en") {
    return [
      "DIGITAL BODY LANGUAGE:",
      "- Rhythm, micro-pauses, occasional two-beat replies — feel thumb-typed, not instant slabs.",
      "- Respect silences; energy can dip slightly on long threads.",
    ].join("\n");
  }
  if (lang === "es") {
    return "LENGUAJE CORPORAL DIGITAL: ritmo, pausas, dos tiempos si encaja.";
  }
  return [
    "LANGAGE CORPOREL NUMÉRIQUE:",
    "- Rythme, pauses, reprises, énergie qui varie — comme WhatsApp tapé au pouce, pas bloc instantané.",
  ].join("\n");
}

/** Multiplicateur léger typing/read côté client selon fatigue fil. */
export function digitalBodyLanguagePacingBoost(fatigue01: number): number {
  const f = Math.max(0, Math.min(1, fatigue01));
  return 1 + 0.14 * f;
}
