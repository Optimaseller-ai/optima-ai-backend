import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type CrmMemorySnapshot = {
  viewedProducts: string[];
  objections: string[];
  preferences: string[];
  budgetNotes?: string;
  activeHours: string[];
  purchaseHints: string[];
};

export function buildCrmMemoryFromState(
  lead: SmartProspectProfile | undefined,
  state: SellerBehaviorConversationState | undefined,
): CrmMemorySnapshot {
  return {
    viewedProducts: [
      ...(state?.productMemory?.viewedProducts ?? []),
      ...(lead?.preferredProducts ?? []),
    ].slice(0, 12),
    objections: state?.commercialMemory?.objections ?? [],
    preferences: [
      ...(state?.commercialMemory?.preferences ?? []),
      lead?.primaryNeed ? `Message pré-chat: ${lead.primaryNeed}` : "Entrée simple — pas de message pré-chat",
      lead?.city ? `Ville: ${lead.city}` : "",
    ].filter(Boolean),
    budgetNotes: state?.commercialMemory?.budgetNotes ?? lead?.budget ?? undefined,
    activeHours: lead?.lastInteraction
      ? [`Dernière activité: ${new Date(lead.lastInteraction).toLocaleString("fr-FR")}`]
      : [],
    purchaseHints: state?.commercialMemory?.likedProducts ?? [],
  };
}

export function formatCrmMemoryPromptBlock(
  lead: SmartProspectProfile | undefined,
  crm: CrmMemorySnapshot,
  lang: "fr" | "en" | "es",
): string | null {
  if (!lead?.name?.trim()) return null;

  if (lang === "en") {
    return [
      "PROSPECT CRM MEMORY (pre-chat + thread):",
      `- Name: ${lead.name}`,
      lead.city ? `- City: ${lead.city}` : null,
      lead.primaryNeed ? `- Main need: ${lead.primaryNeed}` : null,
      lead.leadTemperature ? `- Lead temperature: ${lead.leadTemperature}` : null,
      crm.viewedProducts.length ? `- Products seen: ${crm.viewedProducts.slice(0, 5).join(", ")}` : null,
      crm.objections.length ? `- Objections: ${crm.objections.slice(0, 2).join(" · ")}` : null,
      crm.budgetNotes ? `- Budget hint: ${crm.budgetNotes}` : null,
      "- Use naturally — never dump as a list to the prospect.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (lang === "es") {
    return [
      "MEMORIA CRM:",
      `- Nombre: ${lead.name}`,
      lead.primaryNeed ? `- Necesidad: ${lead.primaryNeed}` : null,
      `- Temperatura: ${lead.leadTemperature}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "MÉMOIRE CRM PROSPECT (pré-chat + fil) :",
    `- Prénom / nom : ${lead.name}`,
    lead.city ? `- Ville : ${lead.city}` : null,
    lead.businessName ? `- Entreprise : ${lead.businessName}` : null,
    lead.primaryNeed
      ? `- Message ou question laissé(e) avant le chat : ${lead.primaryNeed}`
      : `- Pas de message avant le chat : accueil conversationnel uniquement (ne pas forcer la qualification).`,
    `- Température lead : ${lead.leadTemperature}`,
    crm.viewedProducts.length ? `- Produits vus : ${crm.viewedProducts.slice(0, 5).join(", ")}` : null,
    crm.objections.length ? `- Objections : ${crm.objections.slice(0, 2).join(" · ")}` : null,
    crm.budgetNotes ? `- Budget évoqué : ${crm.budgetNotes}` : null,
    "- Réutiliser avec naturel — jamais comme fiche administrative.",
  ]
    .filter(Boolean)
    .join("\n");
}
