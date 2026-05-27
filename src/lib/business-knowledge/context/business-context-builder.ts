import "server-only";

import type { CatalogProductBrief } from "@/lib/business-brain/context/catalog-types";
import type { CommercialMemory, ConversationProfile, ProductMemory } from "@/lib/agents/memory/conversation-state";
import { analyzeCatalogIntelligence } from "../catalog/catalog-intelligence";
import { buildDeliveryPolicyText } from "../delivery/delivery-context";
import { extractActivePromotions } from "../promotions/promotion-engine";
import { deriveBusinessRules } from "../rules/business-rules-engine";
import { generateProductRecommendations } from "../sales/product-recommendation-engine";
import { buildProductMemoryLines } from "../sales/product-memory-context";
import { resolveBusinessSalesStyle, salesStyleGuidance, type LegacyAgentSalesStyle } from "../sales/sales-style-config";
import type {
  BusinessFaqEntry,
  BusinessKnowledgeLang,
  BusinessKnowledgeSnapshot,
  BusinessOperationalFacts,
  BusinessSalesStyle,
  KnowledgeTopic,
} from "../types";
import type { BusinessContextPayload } from "./business-context-payload";

export type BuildBusinessContextInput = {
  lang: BusinessKnowledgeLang;
  topics: KnowledgeTopic[];
  snapshot: BusinessKnowledgeSnapshot;
  prospectMessage: string;
  matchedProducts: CatalogProductBrief[];
  catalogPool?: CatalogProductBrief[];
  faqEntries: BusinessFaqEntry[];
  salesStyleFromSettings?: string | null;
  legacyAgentSalesStyle?: LegacyAgentSalesStyle;
  productMemory?: ProductMemory;
  commercialMemory?: CommercialMemory;
  conversationProfile?: ConversationProfile;
};

export function buildBusinessContextPayload(input: BuildBusinessContextInput): BusinessContextPayload {
  const { snapshot, matchedProducts, prospectMessage, lang, topics } = input;
  const profile = snapshot.profile;
  const facts: BusinessOperationalFacts = snapshot.facts ?? {};

  const salesStyle: BusinessSalesStyle = resolveBusinessSalesStyle({
    settingsStyle: input.salesStyleFromSettings,
    legacyAgentStyle: input.legacyAgentSalesStyle,
  });

  const pool = input.catalogPool?.length ? input.catalogPool : snapshot.products;
  const catalogIntel = analyzeCatalogIntelligence(pool);
  const activePromotions = extractActivePromotions(pool);
  const recommendations = generateProductRecommendations({
    prospectMessage,
    products: matchedProducts.length ? matchedProducts : pool,
    catalogIntel,
    productMemory: input.productMemory,
    conversationProfile: input.conversationProfile,
    salesStyle,
  });

  const productMemoryLines = buildProductMemoryLines({
    productMemory: input.productMemory,
    commercialMemory: input.commercialMemory,
    conversationProfile: input.conversationProfile,
    lang,
  });

  const businessRules = deriveBusinessRules({
    facts,
    lang,
    hasLowStockProducts: catalogIntel.lowStock.length > 0,
  });

  const expertBehaviorHints = [
    salesStyleGuidance(salesStyle, lang),
    lang === "en"
      ? "Sound like a real advisor who works here — short, human, professional. Not an encyclopedia."
      : "Ton conseiller interne — court, humain, professionnel. Pas encyclopédie IA.",
    lang === "en"
      ? "Examples: « This one is popular for battery life. » « We still have a few units. »"
      : "Exemples : « Celui-ci est plus demandé pour l'autonomie. » « Il nous en reste encore quelques-uns. »",
  ];

  return {
    lang,
    topics,
    businessName: profile.businessName,
    country: profile.country,
    city: profile.city,
    timezone: profile.businessIanaTimezone,
    currency: profile.currencyLabel ?? "FCFA / XOF",
    sector: profile.sector,
    businessTone: facts.salesStyleNote ?? "professionnel chaleureux",
    salesStyle,
    salesStyleGuidance: salesStyleGuidance(salesStyle, lang),
    deliveryPolicy: buildDeliveryPolicyText(facts),
    returnPolicy: facts.returnPolicySummary,
    paymentPolicy: facts.paymentsExtraNote,
    workingHours: facts.openHoursWeekday,
    servedCities: facts.servedCities,
    commercialInstructions: facts.commercialInstructions,
    companyImportantNotes: facts.companyImportantNotes,
    mainCategories: catalogIntel.mainCategories,
    catalogIntel,
    activePromotions,
    faq: input.faqEntries,
    relevantProducts: matchedProducts,
    productHighlights: [...catalogIntel.popular, ...catalogIntel.bestSellers].slice(0, 5),
    lowStockAlerts: catalogIntel.lowStock,
    recommendations,
    productMemoryLines,
    expertBehaviorHints,
    businessRules,
  };
}
