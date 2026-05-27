/**
 * Contrat fournisseur — Supabase aujourd'hui, vector / Pinecone demain.
 */

import type { BusinessKnowledgeSnapshot } from "../types";

export type KnowledgeProviderSearchOptions = {
  userId: string;
  queryText: string;
  maxProducts?: number;
  /** Embedding query pour RAG (optionnel). */
  queryEmbedding?: number[];
  matchChunkCount?: number;
};

export interface BusinessKnowledgeProvider {
  readonly id: string;
  loadSnapshot(options: KnowledgeProviderSearchOptions): Promise<BusinessKnowledgeSnapshot>;
}
