import { buildCrmMemoryFromState, formatCrmMemoryPromptBlock } from "@/lib/prospect/crm-memory/crm-memory-engine";
import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { formatPreChatOpeningGuidanceBlock, prospectHasExplicitPreChatNeed } from "./opening-guidance";

export function formatProspectLeadAwarenessBlock(
  lead: SmartProspectProfile | undefined,
  state: SellerBehaviorConversationState | undefined,
  lang: "fr" | "en" | "es",
  brand?: { businessName?: string; agentName?: string },
): string | null {
  if (!lead?.name?.trim()) return null;

  const crm = buildCrmMemoryFromState(lead, state);
  const memoryBlock = formatCrmMemoryPromptBlock(lead, crm, lang);
  const hasNeed = prospectHasExplicitPreChatNeed(lead);
  const agentProf =
    state?.agent_profile && typeof state.agent_profile === "object"
      ? (state.agent_profile as { name?: string })
      : null;
  const openingBlock = !hasNeed
    ? formatPreChatOpeningGuidanceBlock({
        lead,
        businessName: brand?.businessName ?? "",
        agentName: brand?.agentName ?? agentProf?.name ?? "",
        lang,
      })
    : null;

  if (lang === "en") {
    return [
      "PROSPECT AWARENESS (you already know them — do NOT ask for name again):",
      `- Greet ${lead.name} naturally when relevant.`,
      hasNeed ? `- They mentioned: ${lead.primaryNeed}` : "- They only started a chat — no stated product need yet.",
      lead.leadTemperature ? `- Interest level: ${lead.leadTemperature}` : null,
      "- Sound like their usual sales contact — not a generic support bot.",
      openingBlock,
      memoryBlock,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "PRISE DE CONSCIENCE PROSPECT (vous le connaissez déjà — ne redemandez pas le prénom) :",
    `- Accueillir ${lead.name} naturellement quand c’est pertinent.`,
    hasNeed
      ? `- Message laissé avant le chat : ${lead.primaryNeed}`
      : "- Simple entrée en conversation — pas de besoin précisé : accueil humain, pas qualification CRM.",
    `- Température lead : ${lead.leadTemperature}`,
    "- Ton conseiller habituel — pas standard téléphonique froid.",
    openingBlock,
    memoryBlock,
  ]
    .filter(Boolean)
    .join("\n");
}

export function mergeLeadIntoConversationState(
  state: SellerBehaviorConversationState | undefined,
  lead: SmartProspectProfile,
): SellerBehaviorConversationState {
  const prev = state ?? {};
  const memory = Array.isArray(prev.memory) ? [...prev.memory] : [];
  const lines = [
    `Prénom prospect: ${lead.name}.`,
    lead.city ? `Ville: ${lead.city}.` : null,
    lead.primaryNeed ? `Besoin principal: ${lead.primaryNeed}.` : null,
    lead.budget ? `Budget indicatif: ${lead.budget}.` : null,
    `Température lead: ${lead.leadTemperature}.`,
  ].filter(Boolean) as string[];

  const langHint =
    lead.language === "en" ? ("en" as const) : lead.language === "fr" ? ("fr" as const) : ("unknown" as const);

  const prospectProfile = {
    ...(prev.prospectProfile ?? {
      displayName: lead.name,
      civility: "unknown" as const,
      languageHint: langHint,
      habits: [],
      tonePreference: "neutral" as const,
      historySnippets: [],
      updatedAt: Date.now(),
    }),
    displayName: lead.name,
    languageHint: langHint,
    updatedAt: Date.now(),
  };

  return {
    ...prev,
    language: lead.language ?? prev.language ?? "fr",
    prospectProfile,
    prospectLead: lead,
    memory: [...lines, ...memory.filter((l) => !lines.some((x) => l.startsWith(l.slice(0, 12))))].slice(0, 20),
  };
}
