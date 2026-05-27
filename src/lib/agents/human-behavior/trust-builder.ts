/**
 * Micro-confiance discrète — preuve sociale sobre (prompt).
 */

export function formatTrustBuilderPromptBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "TRUST (subtle, not salesy):",
      "- Quiet proof beats hype: “that one moves well”, “feedback’s been good”, “I’d steer you to the second model” — honest advisor, not brochure.",
      "- Never “this product is excellent” or “be reassured”.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "CONFIANZA (sutil):",
      "- Prueba social breve y honesta; oriente sin empujar.",
    ].join("\n");
  }
  return [
    "CONFIANCE DISCRÈTE (niveau 9):",
    "- Preuve douce : « oui celui-ci sort beaucoup », « franchement les retours sont bons », « je préfère vous orienter vers le second modèle » — conseil sincère, pas brochure.",
    "- Jamais « ce produit est excellent » ni « soyez rassuré ».",
  ].join("\n");
}
