import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { logStructured } from "@/lib/logging/structured-log";

export type EmotionalPersistenceSnapshot = {
  mood?: string;
  frustration?: number;
  enthusiasm?: number;
  trust?: number;
  fatigue?: number;
  updatedAt: number;
};

export function restoreEmotionalPersistence(
  state: SellerBehaviorConversationState,
  snapshot: EmotionalPersistenceSnapshot | undefined,
): SellerBehaviorConversationState {
  if (!snapshot) return state;
  const next: SellerBehaviorConversationState = {
    ...state,
    mood: state.mood ?? snapshot.mood,
    emotional_flow: {
      ...(state.emotional_flow ?? {
        frustration01: 0,
        curiosity01: 0,
        interest01: 0,
        fatigue01: 0,
        hesitation01: 0,
        impatience01: 0,
        saturation01: 0,
        highTrustMode: false,
        lastUpdatedAt: Date.now(),
      }),
      frustration01: state.emotional_flow?.frustration01 ?? snapshot.frustration ?? 0,
      interest01: state.emotional_flow?.interest01 ?? snapshot.enthusiasm ?? state.emotional_flow?.interest01 ?? 0,
      fatigue01: state.emotional_flow?.fatigue01 ?? snapshot.fatigue ?? 0,
      highTrustMode: state.emotional_flow?.highTrustMode ?? ((snapshot.trust ?? 0) >= 0.62),
      lastUpdatedAt: Date.now(),
    },
    salesSignalsMemory: {
      ...(state.salesSignalsMemory ?? {}),
      trustLevel01: state.salesSignalsMemory?.trustLevel01 ?? snapshot.trust,
      lastUpdatedAt: Date.now(),
    },
  };
  logStructured("[EMOTION_RESTORED]", {
    trust: next.salesSignalsMemory?.trustLevel01,
    frustration: next.emotional_flow?.frustration01,
    fatigue: next.emotional_flow?.fatigue01,
  });
  return next;
}

export function captureEmotionalPersistence(
  state: SellerBehaviorConversationState | undefined,
): EmotionalPersistenceSnapshot | undefined {
  if (!state) return undefined;
  return {
    mood: state.mood,
    frustration: state.emotional_flow?.frustration01,
    enthusiasm: state.emotional_flow?.interest01,
    trust: state.salesSignalsMemory?.trustLevel01,
    fatigue: state.emotional_flow?.fatigue01,
    updatedAt: Date.now(),
  };
}

