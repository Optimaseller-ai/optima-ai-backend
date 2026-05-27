import "server-only";

/**
 * Le silence fait partie du dialogue : pas forcer une phrase quand un simple vu suffit.
 * Surtout côté prompt ; heuristique pour blocs « tenue ».
 */
export function isProspectMinimalAck(message: string): boolean {
  const t = String(message ?? "").trim().toLowerCase();
  if (!t || t.length > 32) return false;
  return /^(ok|d'accord|dac|oui|non|merci|hm|hmm|👍|🙏)\s*\.?$/i.test(t);
}

export function formatSilencePsychologyV3Block(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "LEVEL 15 — SILENCE PSYCHOLOGY:",
      "- Silence can be human: not every turn needs a follow-up question or filler.",
      "- Short acknowledgments from them (“ok”, “thanks”) → short, grounded replies — no new interrogation.",
    ].join("\n");
  }
  if (lang === "es") {
    return "NIVEL 15 — SILENCIO: respuestas mínimas del prospecto → respuesta breve, sin abrumar.";
  }
  return [
    "NIVEAU 15 — PSYCHOLOGIE DU SILENCE :",
    "- Le silence fait partie d’un vrai chat : ne pas sur-remplir chaque tour.",
    "- Accuse de réception minimalistes (« ok », « merci ») → réponse courte et posée, pas nouvelle question en chaîne.",
  ].join("\n");
}
