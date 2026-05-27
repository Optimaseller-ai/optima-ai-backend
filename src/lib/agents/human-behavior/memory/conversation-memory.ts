import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

/**
 * Vue compacte pour prompts ou moteur comportemental (pas de mutation).
 */
export type ConversationMemorySnapshot = {
  language?: "fr" | "en" | "es";
  mood?: string;
  toneMode?: string;
  recentTopics: string[];
  prospectTone?: string;
  interestLevel?: string;
  buyingIntent?: number;
  productsMentioned: string[];
  objections: string[];
  commercialPreferences: string[];
  memoryLines: string[];
};

export function buildConversationMemorySnapshot(
  state: SellerBehaviorConversationState | undefined,
): ConversationMemorySnapshot {
  if (!state) {
    return {
      recentTopics: [],
      productsMentioned: [],
      objections: [],
      commercialPreferences: [],
      memoryLines: [],
    };
  }

  const cp = state.conversationProfile;
  const pm = state.productMemory;
  const cm = state.commercialMemory;

  return {
    language: state.language,
    mood: typeof state.mood === "string" ? state.mood : undefined,
    toneMode: state.tone_mode,
    recentTopics: [...(cp?.lastTopics ?? [])].slice(0, 8),
    prospectTone: cp?.tone,
    interestLevel: cp?.interestLevel,
    buyingIntent: cp?.buyingIntent,
    productsMentioned: [...(pm?.viewedProducts ?? [])].slice(0, 12),
    objections: [...(cm?.objections ?? [])].slice(0, 8),
    commercialPreferences: [...(cm?.preferences ?? [])].slice(0, 8),
    memoryLines: [...(state.memory ?? [])].map(String).slice(0, 12),
  };
}
