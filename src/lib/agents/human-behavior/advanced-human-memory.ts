import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export function formatAdvancedHumanMemoryBlock(
  state: SellerBehaviorConversationState | undefined,
  lang: "fr" | "en" | "es",
): string | null {
  if (!state) return null;
  const lines: string[] = [];
  const mem = Array.isArray(state.memory) ? state.memory.slice(0, 8) : [];
  const habits = state.socialConversationHabits ?? [];
  const obj = state.commercialMemory?.lastObjectionSnippet;
  const emo = state.prospectEmotionalMemory?.kind;
  const style = state.conversationProfile?.preferredLanguageStyle;
  const tone = state.conversationProfile?.tone;

  if (mem.length) lines.push(...mem.map((x) => String(x).trim()).filter(Boolean));
  if (habits.length) lines.push(`Habitudes sociales: ${habits.join(", ")}`);
  if (obj) lines.push(`Objection récente: ${obj.slice(0, 100)}`);
  if (emo) lines.push(`Épisode émotionnel passé: ${emo}`);
  if (style) lines.push(`Style langage: ${style}`);
  if (tone && tone !== "neutral") lines.push(`Ton prospect: ${tone}`);

  if (!lines.length) return null;

  if (lang === "en") {
    return [
      "ADVANCED HUMAN MEMORY (reuse like a colleague, not a CRM dump):",
      ...lines.map((l) => `- ${l}`),
      "- Weave one natural callback max per reply when relevant.",
    ].join("\n");
  }
  if (lang === "es") {
    return ["MEMORIA AVANZADA:", ...lines.map((l) => `- ${l}`)].join("\n");
  }
  return [
    "MÉMOIRE HUMAINE AVANCÉE (comme un collègue, pas un rapport):",
    ...lines.map((l) => `- ${l}`),
    "- Réutiliser préférences / émotions / objections / ton relationnel naturellement — une touche par message max si pertinent.",
  ].join("\n");
}
