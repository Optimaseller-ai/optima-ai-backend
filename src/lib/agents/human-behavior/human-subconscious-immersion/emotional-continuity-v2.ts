import "server-only";

import type { ProspectTone } from "@/lib/agents/memory/conversation-state";

export type EmotionalContinuityV2 = {
  directiveFr: string;
  directiveEn: string;
  stabilityHint: "hold" | "soft_shift" | "repair";
};

/** Évite les ruptures brutales de ton — guide modèle. */
export function buildEmotionalContinuityV2(args: {
  prospectTone: ProspectTone;
  previousTone?: ProspectTone;
}): EmotionalContinuityV2 {
  const cur = args.prospectTone;
  const prev = args.previousTone ?? cur;

  let stabilityHint: EmotionalContinuityV2["stabilityHint"] = "hold";
  if (prev === "aggressive" || prev === "cold") stabilityHint = "repair";
  else if (cur !== prev && (cur === "hesitant" || prev === "hesitant")) stabilityHint = "soft_shift";

  const directiveFr =
    stabilityHint === "repair"
      ? "Continuité émotionnelle : rester posé — pas basculer ton « vendeur joyeux » après tension."
      : stabilityHint === "soft_shift"
        ? "Transition douce si le prospect hésite — pas de rupture d’énergie brutale."
        : "Garder une ligne émotionnelle stable (même chaleur générale sur le fil).";

  const directiveEn =
    stabilityHint === "repair"
      ? "Emotional continuity: stay grounded — don’t flip to cheery selling after tension."
      : stabilityHint === "soft_shift"
        ? "Soft shift if they hesitate — no abrupt energy swing."
        : "Keep the same emotional baseline across the thread.";

  return { directiveFr, directiveEn, stabilityHint };
}
