import type { AgentStablePersonality, ConversationPersonalityState, PersonalityLevel } from "./conversation-personality-state";
import { buildConversationPersonalityState } from "./personality-memory-engine";

export function coerceConversationPersonalityState(
  state: ConversationPersonalityState | null | undefined,
  stable: AgentStablePersonality,
): ConversationPersonalityState {
  if (
    state &&
    typeof state === "object" &&
    typeof state.agentId === "string" &&
    typeof state.effectiveEnergy === "string"
  ) {
    return state;
  }
  return buildConversationPersonalityState({ stable, previous: state ?? undefined });
}

export type ResponseEnergyPlan = {
  effectiveEnergy: PersonalityLevel;
  pacingHintFr: string;
  pacingHintEn: string;
  reasoning: string;
};

/** Adapte l’énergie au contexte prospect sans trahir la personnalité agent. */
export function deriveResponseEnergy(args: {
  stable: AgentStablePersonality;
  state: ConversationPersonalityState;
  prospectEmotion?: string;
  frustrationLevel01?: number;
  enthusiasm?: boolean;
}): ResponseEnergyPlan {
  const stable = args.stable;
  const state = coerceConversationPersonalityState(args.state, stable);
  let energy = state.effectiveEnergy ?? stable.energyBaseline;
  let reasoning = "énergie_baseline";

  const fr = args.frustrationLevel01 ?? 0;
  const emo = String(args.prospectEmotion ?? "").toLowerCase();

  if (fr >= 0.5 || emo.includes("frustrat") || emo.includes("anger")) {
    energy = "low";
    reasoning = "prospect_frustré_énergie_douce";
  } else if (args.enthusiasm || emo.includes("excit") || emo.includes("enthus")) {
    energy = stable.energyStyle === "calm" ? "medium" : "high";
    reasoning = "prospect_enthousiaste_énergie_modulée";
  } else if (emo.includes("neutral") || fr < 0.2) {
    if (stable.energyStyle === "calm") {
      energy = "low";
      reasoning = "prospect_calme_rester_posé";
    }
  }

  // Borne : ne pas passer de calm agent à hyper dynamique
  if (stable.energyStyle === "calm" && energy === "high") energy = "medium";
  if (stable.energyStyle === "dynamic" && energy === "low" && fr < 0.35) energy = "medium";

  const pacingHintFr =
    energy === "low"
      ? "Rythme posé, phrases courtes, pas d’emballement."
      : energy === "high"
        ? "Réponse un peu plus vive — toujours pro, jamais spam."
        : "Rythme naturel équilibré.";

  const pacingHintEn =
    energy === "low"
      ? "Calm pace, short lines, no rush."
      : energy === "high"
        ? "Slightly livelier — still professional."
        : "Balanced natural pace.";

  return { effectiveEnergy: energy, pacingHintFr, pacingHintEn, reasoning };
}
