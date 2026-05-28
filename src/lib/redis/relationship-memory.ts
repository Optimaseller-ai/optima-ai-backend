import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type RelationshipMemory = {
  firstName?: string | null;
  habits: string[];
  viewedProducts: string[];
  preferences: string[];
  languageStyle?: string;
  responseFrequency?: number;
  implicitBudget?: string;
  historicalObjections: string[];
  updatedAt: number;
};

export function restoreRelationshipMemory(
  state: SellerBehaviorConversationState,
  memory: RelationshipMemory | undefined,
): SellerBehaviorConversationState {
  if (!memory) return state;
  return {
    ...state,
    prospectProfile: state.prospectProfile
      ? {
          ...state.prospectProfile,
          displayName: state.prospectProfile.displayName ?? memory.firstName ?? null,
          habits: Array.from(new Set([...(state.prospectProfile.habits ?? []), ...memory.habits])).slice(0, 18),
        }
      : state.prospectProfile,
    productMemory: {
      ...(state.productMemory ?? { viewedProducts: [] }),
      viewedProducts: Array.from(new Set([...(state.productMemory?.viewedProducts ?? []), ...memory.viewedProducts])).slice(0, 24),
      budgetHint: state.productMemory?.budgetHint ?? memory.implicitBudget,
    },
    commercialMemory: {
      likedProducts: state.commercialMemory?.likedProducts ?? [],
      objections: Array.from(new Set([...(state.commercialMemory?.objections ?? []), ...memory.historicalObjections])).slice(0, 16),
      preferences: Array.from(new Set([...(state.commercialMemory?.preferences ?? []), ...memory.preferences])).slice(0, 16),
      budgetNotes: state.commercialMemory?.budgetNotes ?? memory.implicitBudget,
      lastObjectionSnippet: state.commercialMemory?.lastObjectionSnippet,
    },
    conversationProfile: state.conversationProfile
      ? {
          ...state.conversationProfile,
          preferredLanguageStyle:
            (state.conversationProfile.preferredLanguageStyle ?? memory.languageStyle ?? "neutral") as
              | "formal"
              | "neutral"
              | "warm",
        }
      : state.conversationProfile,
  };
}

export function captureRelationshipMemory(
  state: SellerBehaviorConversationState | undefined,
): RelationshipMemory | undefined {
  if (!state) return undefined;
  return {
    firstName: state.prospectProfile?.displayName ?? null,
    habits: state.prospectProfile?.habits ?? [],
    viewedProducts: state.productMemory?.viewedProducts ?? [],
    preferences: state.commercialMemory?.preferences ?? [],
    languageStyle: state.conversationProfile?.preferredLanguageStyle,
    responseFrequency: state.stats?.turn_count,
    implicitBudget: state.productMemory?.budgetHint ?? state.commercialMemory?.budgetNotes,
    historicalObjections: state.commercialMemory?.objections ?? [],
    updatedAt: Date.now(),
  };
}

