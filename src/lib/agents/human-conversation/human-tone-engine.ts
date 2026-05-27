import type { HumanConversationTone, HumanEnergyLevel, IntentPriority } from "./types";

export type HumanToneHints = {
  tone: HumanConversationTone;
  energy: HumanEnergyLevel;
  microOpeners: string[];
  fluidityRules: string[];
};

/** Micro-variations et fluidité — ton employé boutique, pas assistant. */
export function deriveHumanToneHints(args: {
  priority: IntentPriority;
  frustration: boolean;
  emotion: string;
  lang: "fr" | "en" | "es";
}): HumanToneHints {
  let tone: HumanConversationTone = "professionnel";
  let energy: HumanEnergyLevel = "neutral";

  if (args.frustration || args.emotion === "Frustrated") {
    tone = "rassurant";
    energy = "calm";
  } else if (args.priority === "CRITICAL_BUYING_SIGNAL") {
    tone = "efficace";
    energy = "urgent";
  } else if (args.priority === "HIGH") {
    tone = "efficace";
    energy = "focused";
  } else if (args.emotion === "Excited" || args.emotion === "Hesitant") {
    tone = "chaleureux";
    energy = "warm";
  } else if (args.priority === "LOW") {
    tone = "détendu";
    energy = "calm";
  }

  const microFr = ["Oui.", "D’accord.", "Je vois.", "Exact.", "Normalement oui.", "Ça marche."];
  const microEn = ["Yeah.", "Got it.", "Right.", "Sure.", "Makes sense."];
  const microEs = ["Sí.", "Vale.", "Entiendo.", "Claro."];

  const microOpeners = args.lang === "en" ? microEn : args.lang === "es" ? microEs : microFr;

  const fluidityRules =
    args.lang === "en"
      ? [
          "One thought per message — no stacked corporate paragraphs.",
          "Use contractions and short beats like a real salesperson texting.",
          "Vary openings — do not start every reply the same way.",
        ]
      : args.lang === "es"
        ? [
            "Una idea por mensaje — sin párrafos corporativos.",
            "Frases cortas como un vendedor real por WhatsApp.",
          ]
        : [
            "Une pensée par message — pas de pavé corporate.",
            "Tournures courtes comme une commerciale qui tape sur WhatsApp.",
            "Varier les débuts — ne pas commencer chaque réponse pareil.",
          ];

  return { tone, energy, microOpeners, fluidityRules };
}
