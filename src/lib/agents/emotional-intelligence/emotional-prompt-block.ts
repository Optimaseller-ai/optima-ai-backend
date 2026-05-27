import "server-only";

import type { EmotionalIntelligenceOutput } from "./types";

/** Bloc prompt intelligence émotionnelle — injecté dans le system prompt agent. */
export function formatEmotionalIntelligencePromptBlock(
  output: EmotionalIntelligenceOutput,
  lang: "fr" | "en" | "es",
): string {
  const s = output.state;
  const sup = output.supervisor;
  const a = output.adaptation;

  const header =
    lang === "en"
      ? "EMOTIONAL INTELLIGENCE ENGINE (mandatory — understand feelings like a senior salesperson):"
      : lang === "es"
        ? "MOTOR DE INTELIGENCIA EMOCIONAL (obligatorio):"
        : "INTELLIGENCE ÉMOTIONNELLE (obligatoire — comprendre comme une commerciale expérimentée) :";

  const stateLine =
    lang === "en"
      ? `Dominant: ${s.dominantEmotion} | Trust ${Math.round(s.trustLevel * 100)}% | Buy confidence ${Math.round(s.buyingConfidence * 100)}% | Frustration ${Math.round(s.frustrationLevel * 100)}% | Comfort ${Math.round(s.conversationComfort * 100)}%`
      : `Émotion : ${s.dominantEmotion} | Confiance ${Math.round(s.trustLevel * 100)}% | Confiance achat ${Math.round(s.buyingConfidence * 100)}% | Frustration ${Math.round(s.frustrationLevel * 100)}% | Confort ${Math.round(s.conversationComfort * 100)}%`;

  const supervisorLine =
    lang === "en"
      ? `Supervisor: abandonment risk=${sup.abandonmentRisk} | relation=${sup.relationalQuality} | ${sup.conversationEmotionalState}`
      : `Superviseur : risque abandon=${sup.abandonmentRisk} | relation=${sup.relationalQuality} | ${sup.conversationEmotionalState}`;

  const adaptLines =
    lang === "en"
      ? [
          a.blockAggressiveClose ? "BLOCK hard close / pushy upsell." : null,
          a.accelerateConversion ? "Match enthusiasm — clear next step toward order." : null,
          a.increaseReassurance ? "Extra reassurance with verifiable facts — no generic AI empathy." : null,
          a.slowDownPace ? "Slow pace — listen first." : null,
        ]
      : [
          a.blockAggressiveClose ? "INTERDIT close agressif / upsell insistant." : null,
          a.accelerateConversion ? "Enthousiasme → guider clairement vers la commande." : null,
          a.increaseReassurance ? "Renforcer rassurance avec faits vérifiables — pas empathie IA générique." : null,
          a.slowDownPace ? "Ralentir — écouter d’abord." : null,
        ];

  const empathy =
    lang === "en" ? output.empatheticGuidanceEn : output.empatheticGuidanceFr;
  const anti = output.antiRoboticRules.slice(0, 5);

  return [
    header,
    "",
    stateLine,
    supervisorLine,
    `Adaptation : ${a.reasoning}`,
    ...adaptLines.filter(Boolean).map((l) => `- ${l}`),
    "",
    lang === "en" ? "Empathy guidance:" : "Guidage empathique :",
    ...empathy.map((g) => `- ${g}`),
    "",
    lang === "en" ? "Anti-robot:" : "Anti-robot :",
    ...anti.map((r) => `- ${r}`),
    "",
    lang === "en"
      ? "Goal: prospect feels “this advisor understands me” — not a machine."
      : "Objectif : le prospect ressent « cette conseillère me comprend » — pas une machine.",
  ].join("\n");
}
