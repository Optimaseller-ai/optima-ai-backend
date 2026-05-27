import "server-only";

import { detectKnowledgeTopics, topicNeedsProductCatalog } from "./topic-detector";
import {
  buildTopicSlices,
  filterProductsRelevantToMessage,
  formatCompactProductLines,
} from "./slice-formatters";
import {
  getRelevantValidatedFaqs,
  formatFaqMemorySlice,
  formatBusinessFaqEntriesSlice,
  hydrateValidatedFaqFromDb,
} from "./business-faq-memory";
import { composeBusinessKnowledgePromptBlock } from "./business-knowledge-engine";
import { buildBusinessContextPayload } from "./context/business-context-builder";
import type { CommercialMemory, ConversationProfile, ProductMemory } from "@/lib/agents/memory/conversation-state";
import type { LegacyAgentSalesStyle } from "./sales/sales-style-config";
import type {
  BusinessContextRetrieveInput,
  BusinessContextRetrieveResult,
  BusinessKnowledgeLang,
  BusinessKnowledgeSnapshot,
} from "./types";
import { defaultSupabaseKnowledgeProvider } from "./providers/supabase-knowledge-provider";

export type RetrieveFromSnapshotInput = {
  userId: string;
  prospectMessage: string;
  lang: BusinessKnowledgeLang;
  snapshot: BusinessKnowledgeSnapshot;
  maxProducts?: number;
  salesStyleFromSettings?: string | null;
  legacyAgentSalesStyle?: LegacyAgentSalesStyle;
  productMemory?: ProductMemory;
  commercialMemory?: CommercialMemory;
  conversationProfile?: ConversationProfile;
};

function computeUnknownDataRisk(
  topics: ReturnType<typeof detectKnowledgeTopics>,
  matchedProducts: import("@/lib/business-brain/context/catalog-types").CatalogProductBrief[],
  chunks: string[],
  facts?: import("./types").BusinessOperationalFacts,
): boolean {
  const needsStock = topics.includes("stock");
  const needsPrice = topics.includes("price");
  const needsDelivery = topics.includes("delivery");

  if (needsStock && matchedProducts.length && !matchedProducts.some((p) => p.stock != null)) return true;
  if (needsPrice && matchedProducts.length && !matchedProducts.some((p) => p.priceFcfa != null)) return true;
  if (needsDelivery && !chunks.length && !facts?.deliveryZonesNotes?.trim()) return true;
  return false;
}

function enrichmentHints(
  topics: ReturnType<typeof detectKnowledgeTopics>,
  unknownRisk: boolean,
  lang: BusinessKnowledgeLang,
): string[] {
  const hints: string[] = [];
  if (unknownRisk) {
    hints.push(
      lang === "en"
        ? "Prefer verification phrasing over guessing numbers."
        : "Privilégier « je vérifie » plutôt qu’un chiffre inventé.",
    );
  }
  if (topics.includes("stock")) {
    hints.push(
      lang === "en"
        ? "Stock: calm tone — no aggressive scarcity unless data says low_stock."
        : "Stock : ton calme — pas de fausse urgence.",
    );
  }
  if (topics.includes("delivery")) {
    hints.push(
      lang === "en"
        ? "Delivery: cite zones/delays only from knowledge slices."
        : "Livraison : zones et délais uniquement depuis les tranches.",
    );
  }
  return hints;
}

/**
 * Récupération contextuelle à partir de données déjà chargées (chemin reply.ts).
 */
export function retrieveBusinessContextFromSnapshot(
  input: RetrieveFromSnapshotInput,
): BusinessContextRetrieveResult {
  const { userId, prospectMessage, lang, snapshot } = input;
  const maxProducts = input.maxProducts ?? 4;
  const topics = detectKnowledgeTopics(prospectMessage);

  const matchedProducts = topicNeedsProductCatalog(topics)
    ? filterProductsRelevantToMessage(prospectMessage, snapshot.products, maxProducts)
    : [];

  if (snapshot.faqEntries?.length) hydrateValidatedFaqFromDb(userId, snapshot.faqEntries);

  const adminFaqSlice = snapshot.faqEntries?.length
    ? formatBusinessFaqEntriesSlice(snapshot.faqEntries.slice(0, 4), lang)
    : "";
  const memoryFaqSlice = formatFaqMemorySlice(getRelevantValidatedFaqs(userId, prospectMessage, 2), lang);
  const faqSlice = adminFaqSlice || memoryFaqSlice;

  const slices = buildTopicSlices({
    topics,
    lang,
    profile: snapshot.profile,
    products: matchedProducts,
    documentChunks: snapshot.documentChunks,
    facts: snapshot.facts,
  });

  if (faqSlice) {
    slices.push({
      kind: "faq",
      topic: "faq",
      content: faqSlice,
      grounding: 0.95,
    });
  }

  const unknownDataRisk = computeUnknownDataRisk(
    topics,
    matchedProducts,
    snapshot.documentChunks,
    snapshot.facts,
  );
  const hints = enrichmentHints(topics, unknownDataRisk, lang);

  const faqForPayload = snapshot.faqEntries?.length
    ? snapshot.faqEntries.slice(0, 4)
    : [];

  const contextPayload = buildBusinessContextPayload({
    lang,
    topics,
    snapshot,
    prospectMessage,
    matchedProducts,
    catalogPool: snapshot.products,
    faqEntries: faqForPayload,
    salesStyleFromSettings: input.salesStyleFromSettings,
    legacyAgentSalesStyle: input.legacyAgentSalesStyle,
    productMemory: input.productMemory,
    commercialMemory: input.commercialMemory,
    conversationProfile: input.conversationProfile,
  });

  const promptBlock = composeBusinessKnowledgePromptBlock({
    lang,
    topics,
    slices,
    unknownDataRisk,
    enrichmentHints: hints,
    payload: contextPayload,
  });

  const documentChunksText =
    topics.some((t) => ["faq", "delivery", "sav", "return_policy"].includes(t)) && snapshot.documentChunks.length
      ? snapshot.documentChunks
          .slice(0, 2)
          .map((c, i) => `- Extrait ${i + 1}:\n${c.slice(0, 700)}`)
          .join("\n\n")
      : "";

  return {
    topics,
    slices,
    promptBlock,
    matchedProducts,
    documentChunksText,
    unknownDataRisk,
    enrichmentHints: hints,
    contextPayload,
  };
}

/**
 * Charge + analyse message + injecte contexte minimal.
 */
export async function retrieveBusinessContext(
  input: BusinessContextRetrieveInput,
): Promise<BusinessContextRetrieveResult> {
  const lang: BusinessKnowledgeLang = input.lang ?? "fr";
  const snapshot = await defaultSupabaseKnowledgeProvider.loadSnapshot({
    userId: input.userId,
    queryText: input.prospectMessage,
    maxProducts: input.maxProducts ?? 8,
    matchChunkCount: input.includeVectorChunks ? 4 : 0,
  });

  if (input.facts) snapshot.facts = { ...snapshot.facts, ...input.facts };

  return retrieveBusinessContextFromSnapshot({
    userId: input.userId,
    prospectMessage: input.prospectMessage,
    lang,
    snapshot,
    maxProducts: input.maxProducts ?? 4,
  });
}

/** Texte catalogue compact pour le bloc user prompt — jamais liste complète. */
export function formatRetrievalProductsForPrompt(
  result: BusinessContextRetrieveResult,
  lang: BusinessKnowledgeLang,
): string {
  if (!result.matchedProducts.length) return "";
  return formatCompactProductLines(result.matchedProducts, lang);
}
