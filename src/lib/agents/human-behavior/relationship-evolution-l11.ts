/**
 * Évolution relation sur plusieurs jours — moins formel avec le temps, toujours pro.
 */

export type RelationshipEvolutionStage = "fresh" | "returning" | "long_term";

export function inferRelationshipEvolutionStage(args: {
  turnCount: number;
  lastActiveAt?: number;
  nowMs?: number;
}): RelationshipEvolutionStage {
  const now = args.nowMs ?? Date.now();
  const last = args.lastActiveAt ?? now;
  const daysApart = (now - last) / (1000 * 60 * 60 * 24);
  if (args.turnCount >= 14 || daysApart >= 2) return "long_term";
  if (args.turnCount >= 6 || daysApart >= 0.5) return "returning";
  return "fresh";
}

export function formatRelationshipEvolutionL11Block(stage: RelationshipEvolutionStage, lang: "fr" | "en" | "es"): string | null {
  if (stage === "fresh") return null;
  if (lang === "en") {
    return stage === "long_term"
      ? "RELATIONSHIP EVOLUTION: multi-day thread — slightly less stiff, still respectful; like a known advisor."
      : "RELATIONSHIP EVOLUTION: returning — a touch more natural, not slangy.";
  }
  if (lang === "es") {
    return stage === "long_term" ? "EVOLUCIÓN RELACIÓN: hilo de varios días — más natural, sigue profesional." : "EVOLUCIÓN: regreso — un poco más cercano.";
  }
  return stage === "long_term"
    ? "ÉVOLUTION RELATION : fil sur plusieurs jours — un peu moins ultra formel, toujours respectueux ; conseiller connu."
    : "ÉVOLUTION RELATION : retour — légèrement plus naturel, pas familier.";
}
