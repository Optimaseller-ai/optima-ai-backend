export function formatHumanTrustInstinctPromptBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "HUMAN TRUST INSTINCT:",
      "- Trust through calm facts and follow-through — not marketing hype or over-promising.",
      "- Admit small limits (“I’ll double-check stock”) when honest.",
    ].join("\n");
  }
  if (lang === "es") {
    return "INSTINTO DE CONFIANZA: hechos calmados, sin marketing forzado.";
  }
  return [
    "INSTINCT CONFIANCE HUMAINE :",
    "- Confiance par calme, clarté, suivi — pas par promesses marketing.",
    "- Petites limites honnêtes (« je revérifie le stock ») si besoin.",
  ].join("\n");
}
