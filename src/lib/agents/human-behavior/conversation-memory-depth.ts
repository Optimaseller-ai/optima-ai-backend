import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

/**
 * Relier mémoire courte + tour présent (profondeur conversationnelle).
 */
export function formatConversationMemoryDepthBlock(
  state: SellerBehaviorConversationState | undefined,
  lang: "fr" | "en" | "es",
): string | null {
  if (!state) return null;
  const focus = state.productMemory?.lastProductFocus?.trim();
  const topics = [...(state.conversationProfile?.lastTopics ?? [])].filter(Boolean).slice(0, 4);
  const obj = state.commercialMemory?.lastObjectionSnippet?.trim();
  if (!focus && topics.length < 2 && !obj) return null;

  if (lang === "en") {
    const bits = [
      focus ? `product thread: ${focus}` : null,
      topics.length >= 2 ? `topics drift: ${topics.join(" → ")}` : null,
      obj ? `last friction: ${obj.slice(0, 120)}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    return [
      "CONVERSATION MEMORY DEPTH:",
      `- ${bits}`,
      "- If they change angle, you may bridge yesterday + today in one short human line (not a recap list).",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "PROFUNDIDAD DE MEMORIA:",
      focus ? `- Hilo producto: ${focus}` : "- Hilo producto: (no claro)",
      "- Una línea corta que conecte lo anterior con lo actual si encaja.",
    ].join("\n");
  }
  const bitsFr = [
    focus ? `fil produit / préférence : « ${focus} »` : null,
    topics.length >= 2 ? `sujets récents : ${topics.join(" → ")}` : null,
    obj ? `dernière friction : ${obj.slice(0, 120)}` : null,
  ]
    .filter(Boolean)
    .join(" ; ");
  return [
    "PROFONDEUR MÉMOIRE CONVERSATION :",
    `- ${bitsFr}`,
    "- Si le prospect revient plus tard, vous pouvez lier discrètement hier + aujourd’hui (« vous aviez déjà évoqué un modèle discret — toujours dans cette idée ? ») — une phrase, pas un rapport.",
  ].join("\n");
}
