import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

/** Rappels naturels niveau 11 — « si je me souviens bien… » */
export function formatMemoryContinuityL11Block(
  state: SellerBehaviorConversationState | undefined,
  lang: "fr" | "en" | "es",
): string | null {
  if (!state) return null;
  const prefs = state.commercialMemory?.preferences ?? [];
  const liked = state.commercialMemory?.likedProducts ?? [];
  const focus = state.productMemory?.lastProductFocus?.trim();
  const simple = prefs.some((p) => /simple|basique|discret|sobre/i.test(p));
  const budget = state.commercialMemory?.budgetNotes?.trim();

  const hints: string[] = [];
  if (simple) hints.push("préférence pour le simple / discret");
  if (focus) hints.push(`intérêt récent: ${focus.slice(0, 80)}`);
  if (liked.length) hints.push(`goût: ${liked[0]!.slice(0, 60)}`);
  if (budget) hints.push(`budget évoqué: ${budget.slice(0, 50)}`);

  if (!hints.length) return null;

  if (lang === "en") {
    return [
      "MEMORY CONTINUITY (level 11):",
      ...hints.map((h) => `- ${h}`),
      '- One natural bridge max: “if I remember you preferred simpler models…” — only if memory supports it.',
    ].join("\n");
  }
  if (lang === "es") {
    return ["CONTINUIDAD MEMORIA:", ...hints.map((h) => `- ${h}`)].join("\n");
  }
  return [
    "CONTINUITÉ MÉMOIRE (niveau 11) :",
    ...hints.map((h) => `- ${h}`),
    "- Une reprise naturelle max : « Vous préfériez les modèles simples si je me souviens bien. » — uniquement si la mémoire le justifie.",
  ].join("\n");
}
