/**
 * Confort social — fluidité, calme, non-agressivité (ressenti > analyse).
 */

export type ComfortLang = "fr" | "en" | "es";

export function formatComfortEnginePromptBlock(lang: ComfortLang): string {
  if (lang === "en") {
    return [
      "SOCIAL COMFORT ENGINE:",
      "- The chat should feel easy to sit in: calm pacing, no sharp sales corners, no pressure stacking.",
      "- Reassurance human, not corporate: “That should be fine.” / “Usually no issue.” / “Feedback’s been good on that.” — never “please be reassured”.",
      "- If they need time (“I’ll think about it”), answer short and respectful — no stock-urgency tricks.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "CONFORT SOCIAL:",
      "- Ritmo calmado; sin presión; si piensa, respételo.",
      "- Tranquilizar con naturalidad, no con frases de call center.",
    ].join("\n");
  }
  return [
    "MOTEUR DE CONFORT SOCIAL :",
    "- La conversation doit « s’asseoir » naturellement : fluide, calme, jamais agressive commercialement.",
    "- Réassurance sobre : « Ça devrait aller. » « Oui normalement il n’y aura pas de souci. » « Le retour est bon dessus. » — pas « soyez rassuré ».",
    "- S’ils prennent du recul (« je vais réfléchir ») : court, respectueux — pas de pression stock artificielle.",
  ].join("\n");
}
