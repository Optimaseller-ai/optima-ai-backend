import type { ConversationPersonalityState, ConversationPace, PersonalityLevel } from "./conversation-personality-state";
import type { AgentStablePersonality } from "./conversation-personality-state";

export type PersonalityMemoryInput = {
  stable: AgentStablePersonality;
  previous?: ConversationPersonalityState;
  prospectComfort01?: number;
  turnCount?: number;
  lastUserMessageChars?: number;
};

function paceFromTurns(turns: number, stable: AgentStablePersonality): ConversationPace {
  if (stable.energyStyle === "calm" || stable.patienceLevel === "high") {
    if (turns > 20) return "slow";
    return "normal";
  }
  if (stable.energyStyle === "dynamic") return turns > 8 ? "fast" : "normal";
  return "normal";
}

/** Mémoire style / proximité / rythme — même personne du début à la fin. */
export function buildConversationPersonalityState(input: PersonalityMemoryInput): ConversationPersonalityState {
  const prev = input.previous;
  const turns = input.turnCount ?? 0;
  const comfort =
    typeof input.prospectComfort01 === "number"
      ? input.prospectComfort01
      : (prev?.relationalComfort ?? 0.5);

  let proximity = prev?.proximityLevel ?? 0.35;
  if (turns > 4) proximity = Math.min(0.85, proximity + 0.04);
  if (turns > 12) proximity = Math.min(0.92, proximity + 0.03);

  const consistencyScore = prev
    ? Math.min(0.98, (prev.consistencyScore ?? 0.7) * 0.92 + 0.08)
    : 0.72;

  const recentToneMarkers = [...(prev?.recentToneMarkers ?? [])].slice(-5);

  return {
    agentId: input.stable.agentId,
    consistencyScore,
    proximityLevel: proximity,
    relationalComfort: comfort,
    pace: paceFromTurns(turns, input.stable),
    recentToneMarkers,
    effectiveEnergy: input.stable.energyBaseline,
    lastUpdatedAt: Date.now(),
  };
}

export function recordToneMarker(state: ConversationPersonalityState, marker: string): ConversationPersonalityState {
  const m = marker.trim().slice(0, 32);
  if (!m) return state;
  return {
    ...state,
    recentToneMarkers: [...state.recentToneMarkers, m].slice(-6),
  };
}

export function bumpEffectiveEnergy(state: ConversationPersonalityState, level: PersonalityLevel): ConversationPersonalityState {
  return { ...state, effectiveEnergy: level, lastUpdatedAt: Date.now() };
}
