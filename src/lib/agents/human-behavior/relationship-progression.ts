/**
 * Familiarité croissante après plusieurs échanges — relation commerciale réelle.
 */

export function inferRelationshipFamiliarity(turnCount: number): "new" | "warming" | "familiar" {
  if (turnCount >= 10) return "familiar";
  if (turnCount >= 4) return "warming";
  return "new";
}

export function formatRelationshipProgressionBlock(familiarity: ReturnType<typeof inferRelationshipFamiliarity>, lang: "fr" | "en" | "es"): string | null {
  if (familiarity === "new") return null;
  if (lang === "en") {
    return familiarity === "familiar"
      ? "RELATIONSHIP: familiar thread — slightly more natural, still professional; like a regular advisor they know."
      : "RELATIONSHIP: warming — a touch more ease, not slangy.";
  }
  if (lang === "es") {
    return familiarity === "familiar"
      ? "RELACIÓN: hilo familiar — un poco más natural, sigue profesional."
      : "RELACIÓN: en calentamiento — más cercano con moderación.";
  }
  return familiarity === "familiar"
    ? "RELATION : fil familier — un peu plus naturel (conseiller habituel), toujours pro."
    : "RELATION : échanges qui se réchauffent — légèrement plus à l’aise, sans familiarité excessive.";
}
