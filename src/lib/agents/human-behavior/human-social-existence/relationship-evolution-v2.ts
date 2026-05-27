import "server-only";

import { inferRelationshipFamiliarity, formatRelationshipProgressionBlock } from "../relationship-progression";

/** Après plusieurs tours : plus fluide — s’appuie sur la même continuité sociale. */
export function formatHumanRelationshipEvolutionV2Block(lang: "fr" | "en" | "es", turnCount: number): string | null {
  const familiarity = inferRelationshipFamiliarity(turnCount);
  const base = formatRelationshipProgressionBlock(familiarity, lang);
  const extra =
    lang === "en"
      ? "HUMAN RELATION EVOLUTION V2: let the thread feel like a real ongoing chat — same voice, less ‘reset’ energy."
      : lang === "es"
        ? "EVOLUCIÓN V2: misma voz, menos energía de reinicio."
        : "ÉVOLUTION RELATION V2 : plus de fluidité avec le temps — même voix, même logique, pas de redémarrage artificiel.";
  if (!base) return extra;
  return `${base}\n${extra}`;
}
