/**
 * Stub vector / Pinecone — branchement futur sans casser l’API.
 */

import type { BusinessKnowledgeProvider, KnowledgeProviderSearchOptions } from "./knowledge-provider";
import type { BusinessKnowledgeSnapshot } from "../types";
import { defaultSupabaseKnowledgeProvider } from "./supabase-knowledge-provider";

export class VectorKnowledgeProviderStub implements BusinessKnowledgeProvider {
  readonly id = "vector_stub";

  async loadSnapshot(options: KnowledgeProviderSearchOptions): Promise<BusinessKnowledgeSnapshot> {
    // Fallback Supabase jusqu’à intégration Pinecone / pgvector dédié.
    return defaultSupabaseKnowledgeProvider.loadSnapshot(options);
  }
}
