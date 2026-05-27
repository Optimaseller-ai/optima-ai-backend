import "server-only";

export type ImplicitSocialSituation =
  | "apologizing_for_disturbing"
  | "asking_if_available"
  | "none";

export function detectImplicitSocialSituationV2(message: string): ImplicitSocialSituation {
  const m = String(message ?? "").toLowerCase();
  if (/\b(je\s+vous\s+d[eé]range|d[eé]sol[eé]\s+de\s+d[eé]ranger|sorry\s+to\s+bother|molesto|molestar)\b/i.test(m)) {
    return "apologizing_for_disturbing";
  }
  if (/\b(vous\s+[eê]tes\s+l[àa]|vous\s+êtes\s+dispon|are\s+you\s+there|still\s+available)\b/i.test(m)) {
    return "asking_if_available";
  }
  return "none";
}

export function formatSocialAwarenessV2Hint(situation: ImplicitSocialSituation, lang: "fr" | "en" | "es"): string | null {
  if (situation === "none") return null;
  if (situation === "apologizing_for_disturbing") {
    if (lang === "en") return "They worry they’re bothering you → short human reassurance: “Not at all — I’m here.” / “You’re fine.”";
    if (lang === "es") return "Preocupación de molestar → “No, para nada — estoy aquí.” (corto).";
    return "Crainte de déranger → réponse humaine courte : « Non pas du tout. » / « Je suis dispo. » — pas de blabla.";
  }
  if (lang === "en") return "Checking availability → “Yes — I’m on it.” / “Still here.”";
  if (lang === "es") return "Comprueba disponibilidad → “Sí, aquí estoy.”";
  return "Demande de présence → « Oui je suis là. » / « Je suis dispo. » — naturel.";
}
