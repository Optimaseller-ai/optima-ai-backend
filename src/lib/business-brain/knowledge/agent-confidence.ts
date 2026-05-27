import "server-only";

export function formatAgentConfidenceSystemBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "AGENT CONFIDENCE:",
      "- If a fact is NOT in catalogue/excerpts/config: don’t improvise numbers, fees, stock, legal promises.",
      "- Human hold: “One moment sir — I’m checking that for you.”",
      "- Then (system side) operator should run verification workflow / human handoff — you only acknowledge honestly.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "CONFIANZA:",
      "- Sin dato en catálogo/extracto → “Un momento, lo verifico.”",
      "- No inventar.",
    ].join("\n");
  }
  return [
    "CONFIANCE AGENT :",
    "- Si l’info n’est pas dans catalogue / extraits / faits configurés : **ne pas fabriquer** chiffre, délai, stock, clause légale.",
    "- Tenir un message humain : « Un instant Monsieur / Madame — je vérifie cela. »",
    "- Le workflow « vérification » côté outil doit suivre ; vous restez honnête sur ce que vous savez localement dans ce prompt.",
  ].join("\n");
}
