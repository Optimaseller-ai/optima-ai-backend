import "server-only";

export function formatNaturalReassurancePromptBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return "REASSURANCE (natural): “Should be fine.” / “That one’s pretty reliable.” / “I think it could work for you.” — never corporate guarantees.";
  }
  if (lang === "es") {
    return "REASEGURO natural, breve, humano — sin garantías corporativas.";
  }
  return [
    "RASSURANCE NATURELLE :",
    "Ex. « Oui normalement ça ira. », « Celui-là est plutôt fiable. », « Je pense que ça peut vous convenir. »",
    "Jamais de promesses légales ou ton support client.",
  ].join("\n");
}
