import "server-only";

import type { BusinessKnowledgeProvider, KnowledgeProviderSearchOptions } from "./knowledge-provider";
import type { BusinessKnowledgeSnapshot } from "../types";
import { searchBusinessKnowledge } from "../search-business-knowledge";

export class SupabaseBusinessKnowledgeProvider implements BusinessKnowledgeProvider {
  readonly id = "supabase";

  async loadSnapshot(options: KnowledgeProviderSearchOptions): Promise<BusinessKnowledgeSnapshot> {
    const search = await searchBusinessKnowledge({
      userId: options.userId,
      prospectMessage: options.queryText,
      maxProducts: options.maxProducts ?? 8,
      includeVectorChunks: Boolean(options.queryEmbedding?.length),
      queryEmbedding: options.queryEmbedding,
    });

    return {
      profile: search.profile,
      products: search.products,
      documentChunks: search.documentChunks,
      facts: search.facts,
      faqEntries: search.faqEntries,
      loadedAt: new Date().toISOString(),
    };
  }
}

export const defaultSupabaseKnowledgeProvider = new SupabaseBusinessKnowledgeProvider();
