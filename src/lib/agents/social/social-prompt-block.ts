import "server-only";

import type { SocialHumanizationOutput } from "./social-humanization-engine";

/** Bloc prompt quand tour social mais réponse LLM (pas instant). */
export function formatSocialHumanizationPromptBlock(
  output: SocialHumanizationOutput,
  lang: "fr" | "en" | "es",
): string {
  if (!output.isSocialPriority) return "";

  const header =
    lang === "en"
      ? "SOCIAL HUMANIZATION LAYER (PRIORITY — before any sales/automation):"
      : "COUCHE SOCIALE HUMAINE (PRIORITÉ — avant vente / automation / outils) :";

  const rules =
    lang === "en"
      ? [
          "FORBIDDEN alone: “Let me check”, “One moment”, “I'll verify”.",
          "FORBIDDEN: cold one-word replies without warmth.",
          "FORBIDDEN: business pitch on pure greeting / “how are you” / “what are you doing”.",
          output.suppressCommercial ? "Sales urgency OFF this turn — human presence first." : null,
          output.suppressHoldPhrases ? "No hold phrases — answer as a real person at work." : null,
          output.signal === "personal_activity"
            ? "They asked what you're doing — short human work context, offer help lightly."
            : null,
          output.signal === "wellbeing"
            ? "Answer wellbeing naturally, ask back once — no catalog."
            : null,
        ]
      : [
          "INTERDIT seul : « Je vérifie », « Un instant », « Je regarde ».",
          "INTERDIT : réponse froide d’un mot sans chaleur.",
          "INTERDIT : pitch commercial sur bonjour / ça va / tu fais quoi.",
          output.suppressCommercial ? "Urgence vente OFF ce tour — présence humaine d'abord." : null,
          output.suppressHoldPhrases ? "Pas de hold — répondre comme une personne au travail." : null,
          output.signal === "personal_activity"
            ? "« Tu fais quoi ? » → contexte travail court + disponibilité, pas vérification stock."
            : null,
          output.signal === "wellbeing"
            ? "Répondre au « ça va » naturellement, renvoyer la politesse — pas de catalogue."
            : null,
        ];

  return [header, "", `Signal: ${output.signal} · warmup: ${output.warmup.phase}`, ...rules.filter(Boolean).map((r) => `- ${r}`)].join(
    "\n",
  );
}
