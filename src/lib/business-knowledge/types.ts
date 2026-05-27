/**
 * Types Business Knowledge — compatibles RAG / Supabase / vector store futur.
 */

import type { CatalogProductBrief } from "@/lib/business-brain/context/catalog-types";

export type BusinessKnowledgeLang = "fr" | "en" | "es";

/** Style commercial configuré (profil / knowledge settings). */
export type BusinessSalesStyle = "soft" | "balanced" | "aggressive" | "premium";

export type KnowledgeTopic =
  | "product"
  | "price"
  | "stock"
  | "promotion"
  | "faq"
  | "hours"
  | "delivery"
  | "sav"
  | "return_policy"
  | "currency"
  | "service_area"
  | "payment";

export type StockAvailabilityLabel = "available" | "low_stock" | "out_of_stock" | "unknown";

export type BusinessProfileSnapshot = {
  businessName: string;
  sector?: string;
  city?: string;
  country?: string;
  businessIanaTimezone?: string;
  agentName?: string;
  currencyLabel?: string;
};

/** Faits métier étendus — back-office / documents / config. */
export type BusinessOperationalFacts = Partial<{
  contactsLine: string;
  holidaysNote: string;
  lunchBreakNote: string;
  weekendHoursNote: string;
  openHoursWeekday: string;
  savReturnHumanLine: string;
  paymentsExtraNote: string;
  deliveryZonesNotes: string;
  servedCities: string[];
  returnPolicySummary: string;
  salesStyleNote: string;
  commercialInstructions: string;
  companyImportantNotes: string;
}>;

export type KnowledgeSliceKind =
  | "identity"
  | "products"
  | "pricing"
  | "stock"
  | "promotions"
  | "delivery"
  | "hours"
  | "faq"
  | "sav"
  | "returns"
  | "currency"
  | "confidence"
  | "document_excerpt";

export type KnowledgeSlice = {
  kind: KnowledgeSliceKind;
  topic: KnowledgeTopic | "general";
  /** Texte compact pour prompt — jamais catalogue complet. */
  content: string;
  /** Confiance 0–1 sur ancrage données réelles. */
  grounding: number;
};

/** Identité profil — lecture seule dans l'UI Knowledge (pas de duplication de champs). */
export type BusinessKnowledgeSettingsRow = {
  user_id: string;
  currency: string;
  served_cities: string[] | null;
  business_hours_weekday: string | null;
  business_hours_weekend: string | null;
  delivery_zones_notes: string | null;
  delivery_delay_notes: string | null;
  delivery_cost_notes: string | null;
  delivery_methods: string | null;
  payment_notes: string | null;
  warranty_notes: string | null;
  sav_notes: string | null;
  return_policy_summary: string | null;
  contacts_line: string | null;
  sales_style_notes: string | null;
  sales_style: string | null;
  commercial_instructions: string | null;
  company_important_notes: string | null;
};

export type ProfileIdentityForKnowledge = {
  businessName: string;
  sector?: string;
  country?: string;
  city?: string;
  offer?: string;
  goal?: string;
  contactPhone?: string;
  timezoneLabel?: string;
};

export type BusinessFaqCategory =
  | "delivery"
  | "payment"
  | "warranty"
  | "sav"
  | "returns"
  | "hours"
  | "general";

export type BusinessFaqEntry = {
  id: string;
  category: BusinessFaqCategory;
  question: string;
  answer: string;
  updatedAt?: string;
};

export type BusinessKnowledgeSnapshot = {
  profile: BusinessProfileSnapshot;
  products: CatalogProductBrief[];
  documentChunks: string[];
  facts: BusinessOperationalFacts;
  faqEntries?: BusinessFaqEntry[];
  loadedAt: string;
};

export type BusinessKnowledgeSearchInput = {
  userId: string;
  prospectMessage: string;
  maxProducts?: number;
  includeVectorChunks?: boolean;
  queryEmbedding?: number[];
};

export type BusinessKnowledgeSearchResult = {
  topics: KnowledgeTopic[];
  profile: BusinessProfileSnapshot;
  products: CatalogProductBrief[];
  faqEntries: BusinessFaqEntry[];
  facts: BusinessOperationalFacts;
  documentChunks: string[];
  matchedCategories: string[];
  salesStyleFromSettings?: string | null;
};

export type BusinessContextRetrieveInput = {
  userId: string;
  prospectMessage: string;
  lang?: BusinessKnowledgeLang;
  /** Max produits dans une tranche (défaut 4). */
  maxProducts?: number;
  /** Inclure recherche vectorielle documents. */
  includeVectorChunks?: boolean;
  facts?: BusinessOperationalFacts;
};

export type BusinessContextRetrieveResult = {
  topics: KnowledgeTopic[];
  slices: KnowledgeSlice[];
  /** Bloc prompt minimal prêt à injecter. */
  promptBlock: string;
  matchedProducts: CatalogProductBrief[];
  documentChunksText: string;
  unknownDataRisk: boolean;
  enrichmentHints: string[];
  /** Payload structuré — pour logs / extensions. */
  contextPayload?: import("./context/business-context-payload").BusinessContextPayload;
};
