import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export function formatConversationContinuityBlock(
  state: SellerBehaviorConversationState | undefined,
  lang: "fr" | "en" | "es",
): string | null {
  if (!state) return null;

  const hints: string[] = [];
  const product = state.productMemory;
  const commercial = state.commercialMemory;
  const profile = state.conversationProfile;

  if (product?.budgetHint) hints.push(String(product.budgetHint));
  if (product?.lastProductFocus) hints.push(String(product.lastProductFocus));
  if (commercial?.budgetNotes) hints.push(String(commercial.budgetNotes));
  if (profile?.lastTopics?.length) hints.push(profile.lastTopics.slice(-2).join(", "));

  if (!hints.length) return null;

  const joined = hints.slice(0, 3).join(" · ");
  if (lang === "en") {
    return `CONTINUITY: thread stays alive — weave naturally: ${joined}. No “as mentioned before” robot phrasing.`;
  }
  if (lang === "es") {
    return `CONTINUIDAD: hilo vivo — ${joined}.`;
  }
  return `CONTINUITÉ : fil vivant — réutiliser naturellement : ${joined}. Pas de « comme mentionné précédemment » robot.`;
}
