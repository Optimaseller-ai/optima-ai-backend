import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type HumanConversationMemoryHints = {
  budget?: string;
  style?: string;
  hesitations?: string;
  relationalTone?: string;
  interests: string[];
};

export function extractHumanConversationMemory(
  state: SellerBehaviorConversationState | undefined,
): HumanConversationMemoryHints {
  const product = state?.productMemory;
  const commercial = state?.commercialMemory;
  const profile = state?.conversationProfile;
  const sales = state?.salesSignalsMemory;

  const interests: string[] = [];
  if (product?.lastMentionedInterest) interests.push(product.lastMentionedInterest);
  if (product?.lastProductFocus) interests.push(product.lastProductFocus);
  if (profile?.preferredProducts?.length) interests.push(...profile.preferredProducts.slice(0, 2));
  if (profile?.lastTopics?.length) interests.push(profile.lastTopics[profile.lastTopics.length - 1]!);
  if (commercial?.likedProducts?.length) interests.push(commercial.likedProducts[0]!);

  const budget =
    product?.budgetHint ??
    commercial?.budgetNotes ??
    sales?.budgetEcho?.[sales.budgetEcho.length - 1];

  const style =
    sales?.preferredEcho?.[sales.preferredEcho.length - 1] ??
    profile?.preferredLanguageStyle;

  const hesitations = commercial?.lastObjectionSnippet;

  return {
    budget: budget ? String(budget) : undefined,
    style: style ? String(style) : undefined,
    hesitations: hesitations ? String(hesitations) : undefined,
    relationalTone: profile?.tone ? String(profile.tone) : undefined,
    interests: interests.filter(Boolean).slice(0, 4),
  };
}

export function formatHumanConversationMemoryBlock(
  mem: HumanConversationMemoryHints,
  lang: "fr" | "en" | "es",
): string | null {
  const lines: string[] = [];
  if (mem.budget) lines.push(`budget: ${mem.budget}`);
  if (mem.style) lines.push(`style: ${mem.style}`);
  if (mem.hesitations) lines.push(`hesitations: ${mem.hesitations}`);
  if (mem.relationalTone) lines.push(`tone: ${mem.relationalTone}`);
  if (mem.interests.length) lines.push(`interests: ${mem.interests.join(", ")}`);

  if (!lines.length) return null;

  const body = lines.join(" | ");
  if (lang === "en") {
    return `HUMAN MEMORY (reuse naturally, never list-like): ${body}`;
  }
  if (lang === "es") {
    return `MEMORIA HUMANA: ${body}`;
  }
  return `MÉMOIRE HUMAINE (réutiliser avec naturel, pas en liste) : ${body}`;
}
