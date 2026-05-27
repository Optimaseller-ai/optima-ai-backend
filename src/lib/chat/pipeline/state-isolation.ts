import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import type { ConversationPipelineRuntimeSnapshot } from "./pipeline-types";
import { jsonSafe } from "./json-safe";

/** Mémoire conversationnelle (profil, produits, signaux). */
export type ConversationMemorySlice = Pick<
  SellerBehaviorConversationState,
  | "language"
  | "memory"
  | "conversationProfile"
  | "lastSellerIntent"
  | "productMemory"
  | "commercialMemory"
  | "salesSignalsMemory"
  | "prospectProfile"
  | "prospectLead"
  | "humanConversationMemory"
>;

/** État humain (émotion, personnalité, social). */
export type HumanStateSlice = Pick<
  SellerBehaviorConversationState,
  | "prospectEmotionalState"
  | "prospectEmotionalMemory"
  | "conversationPersonalityState"
  | "socialWarmup"
  | "conversationSocialV2"
  | "socialConversationHabits"
  | "conversationalEtiquette"
  | "mood"
  | "tone_mode"
>;

/** État automation (workflows, relances). */
export type AutomationStateSlice = Pick<SellerBehaviorConversationState, "automation">;

/** Runtime pipeline (dernier trace — pas pour UI client public). */
export type PipelineRuntimeSlice = {
  pipelineRuntime?: ConversationPipelineRuntimeSnapshot;
};

export function extractConversationMemorySlice(
  state: SellerBehaviorConversationState,
): ConversationMemorySlice {
  return {
    language: state.language,
    memory: state.memory,
    conversationProfile: state.conversationProfile,
    lastSellerIntent: state.lastSellerIntent,
    productMemory: state.productMemory,
    commercialMemory: state.commercialMemory,
    salesSignalsMemory: state.salesSignalsMemory,
    prospectProfile: state.prospectProfile,
    prospectLead: state.prospectLead,
    humanConversationMemory: state.humanConversationMemory,
  };
}

export function extractHumanStateSlice(state: SellerBehaviorConversationState): HumanStateSlice {
  return {
    prospectEmotionalState: state.prospectEmotionalState,
    prospectEmotionalMemory: state.prospectEmotionalMemory,
    conversationPersonalityState: state.conversationPersonalityState,
    socialWarmup: state.socialWarmup,
    conversationSocialV2: state.conversationSocialV2,
    socialConversationHabits: state.socialConversationHabits,
    conversationalEtiquette: state.conversationalEtiquette,
    mood: state.mood,
    tone_mode: state.tone_mode,
  };
}

export function extractAutomationSlice(state: SellerBehaviorConversationState): AutomationStateSlice {
  return { automation: state.automation };
}

/** Fusionne les tranches + orchestrateur + runtime pour persistance API. */
export function assemblePersistedConversationState(args: {
  memory: ConversationMemorySlice;
  human: HumanStateSlice;
  automation: AutomationStateSlice;
  liveOrchestrator?: SellerBehaviorConversationState["liveOrchestrator"];
  stats?: SellerBehaviorConversationState["stats"];
  preferences?: SellerBehaviorConversationState["preferences"];
  regionStyle?: SellerBehaviorConversationState["regionStyle"];
  pipelineRuntime?: ConversationPipelineRuntimeSnapshot;
}): SellerBehaviorConversationState {
  const merged: SellerBehaviorConversationState = {
    ...args.memory,
    ...args.human,
    ...args.automation,
    stats: args.stats,
    preferences: args.preferences,
    regionStyle: args.regionStyle,
    liveOrchestrator: args.liveOrchestrator,
    ...(args.pipelineRuntime ? { pipelineRuntime: args.pipelineRuntime } : {}),
  };
  return jsonSafe(merged, merged);
}
