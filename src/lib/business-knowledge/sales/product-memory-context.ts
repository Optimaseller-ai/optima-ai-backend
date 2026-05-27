import type { CommercialMemory, ConversationProfile, ProductMemory } from "@/lib/agents/memory/conversation-state";
import type { BusinessKnowledgeLang } from "../types";

export function buildProductMemoryLines(args: {
  productMemory?: ProductMemory;
  commercialMemory?: CommercialMemory;
  conversationProfile?: ConversationProfile;
  lang: BusinessKnowledgeLang;
}): string[] {
  const lines: string[] = [];
  const { productMemory, commercialMemory, conversationProfile, lang } = args;

  const viewed = productMemory?.viewedProducts ?? [];
  const liked = commercialMemory?.likedProducts ?? conversationProfile?.preferredProducts ?? [];
  const focus = productMemory?.lastProductFocus ?? productMemory?.lastMentionedInterest;
  const budget = productMemory?.budgetHint ?? commercialMemory?.budgetNotes;

  if (focus) {
    lines.push(
      lang === "en"
        ? `Last product interest: ${focus} — can reference naturally if still relevant.`
        : `Dernier intérêt produit : ${focus} — peut le mentionner naturellement si toujours pertinent.`,
    );
  }

  if (viewed.length) {
    const last = viewed[viewed.length - 1];
    lines.push(
      lang === "en"
        ? `Recently viewed: ${last}${viewed.length > 1 ? ` (and ${viewed.length - 1} other)` : ""}.`
        : `Vu récemment : ${last}${viewed.length > 1 ? ` (+ ${viewed.length - 1} autre(s))` : ""}.`,
    );
  }

  if (liked.length) {
    lines.push(
      lang === "en"
        ? `Liked / preferred: ${liked.slice(0, 3).join(", ")}.`
        : `Apprécié / préféré : ${liked.slice(0, 3).join(", ")}.`,
    );
  }

  if (budget) {
    lines.push(lang === "en" ? `Budget hint: ${budget}.` : `Indice budget : ${budget}.`);
  }

  const objections = commercialMemory?.objections ?? [];
  if (objections.length) {
    lines.push(
      lang === "en"
        ? `Past objections: ${objections.slice(0, 2).join("; ")} — reassure without repeating scripts.`
        : `Objections passées : ${objections.slice(0, 2).join(" ; ")} — rassurer sans script robot.`,
    );
  }

  const temp = conversationProfile?.interestLevel;
  if (temp === "hot") {
    lines.push(lang === "en" ? "Prospect temperature: hot — can propose next step calmly." : "Température : chaud — prochaine étape possible avec sobriété.");
  } else if (temp === "cold") {
    lines.push(lang === "en" ? "Prospect temperature: cold — listen more, sell less." : "Température : froid — plus d'écoute, moins de vente.");
  }

  return lines;
}

export function formatProductMemoryBlock(lines: string[], lang: BusinessKnowledgeLang): string {
  if (!lines.length) return "";
  const header = lang === "en" ? "PROSPECT PRODUCT MEMORY:" : "MÉMOIRE PRODUIT PROSPECT :";
  return [header, ...lines.map((l) => `- ${l}`)].join("\n");
}
