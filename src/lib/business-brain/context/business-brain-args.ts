/**
 * Profil léger — évite tout import depuis seller-prompts (cycle).
 */

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import type { CatalogProductBrief } from "./catalog-types";

/** Données optionnelles métier — enrichir depuis back-office sans halluciner. */
export type ExtendedBusinessFacts = Partial<{
  contactsLine: string;
  holidaysNote: string;
  lunchBreakNote: string;
  weekendHoursNote: string;
  openHoursWeekday: string;
  savReturnHumanLine: string;
  paymentsExtraNote: string;
  deliveryZonesNotes: string;
}>;

export type BusinessProfileLite = {
  businessName: string;
  sector?: string;
  city?: string;
  country?: string;
  businessIanaTimezone?: string;
  agentName?: string;
};

export type BusinessBrainComposeArgs = {
  lang: "fr" | "en" | "es";
  profile: BusinessProfileLite;
  conversationState?: SellerBehaviorConversationState;
  catalog: CatalogProductBrief[];
  chunksPresent: boolean;
  facts?: ExtendedBusinessFacts;
};
