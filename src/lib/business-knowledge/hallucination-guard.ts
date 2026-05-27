/**
 * Protection anti-hallucination — phrases sûres quand donnée absente.
 */

import type { BusinessKnowledgeLang } from "./types";

export function holdPhraseUnknownFact(lang: BusinessKnowledgeLang, civility?: "monsieur" | "madame" | "neutral"): string {
  const civ = civility === "madame" ? "Madame" : civility === "monsieur" ? "Monsieur" : "Monsieur / Madame";
  if (lang === "en") return "One moment — I'm checking that for you.";
  if (lang === "es") return "Un momento — lo verifico ahora.";
  return `Je vérifie cela ${civ}.`;
}

export function phraseMissingInformation(lang: BusinessKnowledgeLang): string {
  if (lang === "en") return "I don't have that detail confirmed in our system right now — I'll verify for you.";
  if (lang === "es") return "No tengo ese dato confirmado en el sistema por ahora — lo verifico.";
  return "Je n'ai pas encore cette information actuellement — je vous confirme dès que possible.";
}

export function formatHallucinationGuardBlock(lang: BusinessKnowledgeLang): string {
  if (lang === "en") {
    return [
      "GROUNDING RULES (mandatory):",
      "- Never invent price, stock count, delivery SLA, return window, or promo %.",
      `- If missing: "${holdPhraseUnknownFact("en")}" or "${phraseMissingInformation("en")}"`,
      "- Only cite numbers present in KNOWLEDGE SLICES below.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "REGLAS:",
      "- No inventar precios, stock ni plazos.",
      `- Sin dato: "${holdPhraseUnknownFact("es")}"`,
    ].join("\n");
  }
  return [
    "RÈGLES D'ANCRAGE (obligatoire) :",
    "- Interdit d'inventer prix, stock, délai livraison, politique retour ou promo.",
    `- Si donnée absente : « ${holdPhraseUnknownFact("fr")} » ou « ${phraseMissingInformation("fr")} »`,
    "- Ne citer que les chiffres présents dans les TRANCHES CONNAISSANCE ci-dessous.",
  ].join("\n");
}
