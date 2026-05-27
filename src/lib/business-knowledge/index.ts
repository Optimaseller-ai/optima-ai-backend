export type {
  BusinessContextRetrieveInput,
  BusinessContextRetrieveResult,
  BusinessKnowledgeLang,
  BusinessKnowledgeSnapshot,
  BusinessKnowledgeSearchInput,
  BusinessKnowledgeSearchResult,
  BusinessOperationalFacts,
  BusinessProfileSnapshot,
  BusinessFaqCategory,
  BusinessFaqEntry,
  ProfileIdentityForKnowledge,
  BusinessKnowledgeSettingsRow,
  KnowledgeSlice,
  KnowledgeTopic,
  StockAvailabilityLabel,
} from "./types";

export { searchBusinessKnowledge, pickRelevantFaqEntries } from "./search-business-knowledge";
export {
  indexProductKnowledge,
  removeProductKnowledgeIndex,
  reindexAllProductsForUser,
  buildProductSearchText,
} from "./catalog/product-indexer";
export {
  loadBusinessKnowledgeSettings,
  loadBusinessFaqEntries,
  loadBusinessProfileSnapshot,
  settingsRowToOperationalFacts,
} from "./catalog/catalog-settings-loader";
export {
  loadBusinessKnowledgeProfile,
  profileRowToIdentity,
  profileRowToSnapshot,
  mergeProfileKnowledgeFacts,
  type BusinessKnowledgeProfileBundle,
} from "./profile/business-knowledge-profile";

export {
  retrieveBusinessContext,
  retrieveBusinessContextFromSnapshot,
  formatRetrievalProductsForPrompt,
} from "./business-context-retriever";

export { composeBusinessKnowledgePromptBlock, runBusinessKnowledgeEngine } from "./business-knowledge-engine";
export { buildBusinessContextPayload } from "./context/business-context-builder";
export type { BusinessContextPayload } from "./context/business-context-payload";
export { analyzeCatalogIntelligence, formatCatalogIntelligenceBlock } from "./catalog/catalog-intelligence";
export { extractActivePromotions, formatPromotionBlock } from "./promotions/promotion-engine";
export { deriveBusinessRules, formatBusinessRulesBlock } from "./rules/business-rules-engine";
export { buildFaqMemoryBlock } from "./faq/faq-memory-engine";
export { buildDeliveryPolicyText, formatDeliveryContextBlock } from "./delivery/delivery-context";
export {
  resolveBusinessSalesStyle,
  salesStyleGuidance,
  normalizeBusinessSalesStyle,
  type LegacyAgentSalesStyle,
} from "./sales/sales-style-config";
export type { BusinessSalesStyle } from "./types";
export { generateProductRecommendations, formatRecommendationBlock } from "./sales/product-recommendation-engine";
export { buildProductMemoryLines, formatProductMemoryBlock } from "./sales/product-memory-context";
export { detectKnowledgeTopics, topicNeedsProductCatalog } from "./topic-detector";
export {
  holdPhraseUnknownFact,
  phraseMissingInformation,
  formatHallucinationGuardBlock,
} from "./hallucination-guard";
export {
  recordValidatedFaq,
  getRelevantValidatedFaqs,
  formatFaqMemorySlice,
  formatBusinessFaqEntriesSlice,
  hydrateValidatedFaqFromDb,
  type ValidatedFaqEntry,
} from "./business-faq-memory";
export {
  stockAvailabilityLabel,
  formatStockLineHuman,
  formatStockSlice,
} from "./stock-labels";
export {
  filterProductsRelevantToMessage,
  formatCompactProductLines,
} from "./slice-formatters";

export type { BusinessKnowledgeProvider, KnowledgeProviderSearchOptions } from "./providers/knowledge-provider";
export {
  SupabaseBusinessKnowledgeProvider,
  defaultSupabaseKnowledgeProvider,
} from "./providers/supabase-knowledge-provider";
export { VectorKnowledgeProviderStub } from "./providers/vector-knowledge-provider.stub";
