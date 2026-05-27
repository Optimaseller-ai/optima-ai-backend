/**
 * Payload unifié — connaissance métier injectée dans chaque génération IA.
 */

import type { CatalogProductBrief } from "@/lib/business-brain/context/catalog-types";
import type { CatalogIntelligenceResult } from "../catalog/catalog-intelligence";
import type { BusinessFaqEntry, BusinessKnowledgeLang, BusinessSalesStyle, KnowledgeTopic } from "../types";

export type ProductHighlight = {
  name: string;
  reason: string;
  priceFcfa?: number | null;
  stock?: number | null;
  promo?: string | null;
};

export type ActivePromotion = {
  label: string;
  productName?: string;
  detail?: string;
};

export type BusinessRuleHint = {
  id: string;
  rule: string;
  severity: "must" | "should";
};

export type ProductRecommendationHint = {
  productName: string;
  angle: string;
  confidence: number;
};

export type BusinessContextPayload = {
  lang: BusinessKnowledgeLang;
  topics: KnowledgeTopic[];

  businessName: string;
  country?: string;
  city?: string;
  timezone?: string;
  currency: string;
  sector?: string;

  businessTone: string;
  salesStyle: BusinessSalesStyle;
  salesStyleGuidance: string;

  deliveryPolicy?: string;
  returnPolicy?: string;
  paymentPolicy?: string;
  workingHours?: string;
  servedCities?: string[];

  commercialInstructions?: string;
  companyImportantNotes?: string;

  mainCategories: string[];
  catalogIntel: CatalogIntelligenceResult;
  activePromotions: ActivePromotion[];
  faq: BusinessFaqEntry[];

  /** Produits pertinents au message (injection prompt). */
  relevantProducts: CatalogProductBrief[];
  productHighlights: ProductHighlight[];
  lowStockAlerts: ProductHighlight[];
  recommendations: ProductRecommendationHint[];

  productMemoryLines: string[];
  expertBehaviorHints: string[];
  businessRules: BusinessRuleHint[];
};
