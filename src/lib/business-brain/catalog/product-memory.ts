import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

/**
 * Mémoire produit prospect — s’appuie sur `productMemory` + profil catalogue mental.
 */
export function formatProductMemoryEngineBlock(args: {
  conversationState?: SellerBehaviorConversationState;
  lang: "fr" | "en" | "es";
}): string | null {
  const pm = args.conversationState?.productMemory;
  const prefs = args.conversationState?.conversationProfile?.preferredProducts ?? [];
  const parts: string[] = [];

  const viewed = Array.isArray(pm?.viewedProducts) ? pm!.viewedProducts!.filter(Boolean).slice(0, 10) : [];
  const focus = pm?.lastProductFocus ? String(pm.lastProductFocus).slice(0, 140) : null;
  const budget = pm?.budgetHint ? String(pm.budgetHint).slice(0, 42) : null;
  const interest = pm?.lastMentionedInterest ? String(pm.lastMentionedInterest).slice(0, 90) : null;

  if (viewed.length) {
    parts.push(args.lang === "en" ? `Products seen (thread): ${viewed.join(", ")}.` : `Produits vus (fil): ${viewed.join(", ")}.`);
  }
  if (prefs.length) {
    parts.push(
      args.lang === "en"
        ? `Stated prefs / echoes: ${prefs.slice(0, 8).join(", ")}.`
        : `Préférences / modèles évoqués: ${prefs.slice(0, 8).join(", ")}.`,
    );
  }
  if (focus) {
    parts.push(args.lang === "en" ? `Last product focus: ${focus}.` : `Dernier focus produit: ${focus}.`);
  }
  if (budget) {
    parts.push(args.lang === "en" ? `Budget echo: ${budget}.` : `Budget évoqué: ${budget}.`);
  }
  if (interest) {
    parts.push(args.lang === "en" ? `Last inquiry snippet: ${interest}.` : `Dernière ligne d’intérêt: ${interest}.`);
  }

  const mem = Array.isArray(args.conversationState?.commercialMemory?.objections)
    ? args.conversationState!.commercialMemory!.objections!.slice(0, 3)
    : [];
  if (mem.length) {
    parts.push(args.lang === "en" ? `Past objections to respect: ${mem.join(" · ")}.` : `Objections déjà formulées: ${mem.join(" · ")}.`);
  }

  if (!parts.length) return null;
  const hdr =
    args.lang === "en"
      ? "PRODUCT MEMORY ENGINE (reuse naturally, don’t re-ask needless items):"
      : args.lang === "es"
        ? "MEMORIA DE PRODUCTO (reutilice sin re-preguntar):"
        : "MÉMOIRE PRODUITS / DEMANDES (réutiliser sans reposer inutilement) :";
  return [hdr, ...parts.map((p) => `- ${p}`)].join("\n");
}
