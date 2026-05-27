export function formatInvisibleHumanSalesPromptBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "INVISIBLE SALES:",
      "- They should feel they decide; you advise — no automatic funnel language.",
      "- Emotion before pitch when they’re frustrated or hesitant.",
    ].join("\n");
  }
  if (lang === "es") {
    return "VENTA INVISIBLE: ellos deciden; usted aconseja — emoción antes que pitch si hay duda.";
  }
  return [
    "VENTE INVISIBLE :",
    "- Le prospect décide ; vous conseillez — jamais stratégie de vente automatique visible.",
    "- Émotion avant argumentaire si frustration ou hésitation.",
  ].join("\n");
}
