import "server-only";

import type { PersonalityConsistencyOutput } from "./personality-consistency-engine";

export function formatPersonalityConsistencyPromptBlock(
  output: PersonalityConsistencyOutput,
  lang: "fr" | "en" | "es",
): string {
  const s = output.stable;
  const sup = output.supervisor;

  const header =
    lang === "en"
      ? "PERSONALITY CONSISTENCY ENGINE (same human from start to finish — mandatory):"
      : "PERSONNALITÉ COHÉRENTE (même personne du début à la fin — obligatoire) :";

  const profileLine =
    lang === "en"
      ? `${s.displayName}: warmth=${s.warmthLevel}, professionalism=${s.professionalismLevel}, salesPressure=${s.salesPressure}, energy=${output.energy.effectiveEnergy}, tone=${s.toneStyle}`
      : `${s.displayName} : chaleur=${s.warmthLevel}, pro=${s.professionalismLevel}, pression vente=${s.salesPressure}, énergie=${output.energy.effectiveEnergy}, ton=${s.toneStyle}`;

  const rules = lang === "en" ? output.consistencyRulesEn : output.consistencyRulesFr;

  return [
    header,
    "",
    profileLine,
    lang === "en"
      ? `Supervisor: consistency ${Math.round(sup.consistencyScore * 100)}% | humanization ${sup.humanizationQuality} | stability ${sup.emotionalStability}`
      : `Superviseur : cohérence ${Math.round(sup.consistencyScore * 100)}% | humanisation ${sup.humanizationQuality} | stabilité ${sup.emotionalStability}`,
    "",
    ...rules.map((r) => `- ${r}`),
    "",
    lang === "en"
      ? "Goal: prospect talks to the SAME advisor — not a shifting AI engine."
      : "Objectif : le prospect parle à la MÊME conseillère — pas un moteur IA qui change.",
  ].join("\n");
}

/** Version courte — budget prompt (pas le bloc complet à chaque tour). */
export function formatPersonalityConsistencyPromptBlockShort(
  output: PersonalityConsistencyOutput,
  lang: "fr" | "en" | "es",
): string {
  const s = output.stable;
  const line =
    lang === "en"
      ? `Persona: ${s.displayName} | tone=${s.toneStyle} | energy=${output.energy.effectiveEnergy} | warmth=${s.warmthLevel} | stay same human advisor.`
      : `Persona : ${s.displayName} | ton=${s.toneStyle} | énergie=${output.energy.effectiveEnergy} | chaleur=${s.warmthLevel} | rester la même conseillère.`;
  const pace =
    lang === "en"
      ? output.energy.pacingHintEn
      : output.energy.pacingHintFr;
  return [line, `- ${pace}`].join("\n");
}
