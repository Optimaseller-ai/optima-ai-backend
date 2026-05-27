import "server-only";

import { createAdminClientSafe } from "@/lib/supabase/admin";
import { mapDbProductsToCatalogBrief } from "@/lib/business-brain";
import { detectKnowledgeTopics } from "./topic-detector";
import { shouldSearchCatalog } from "./should-search-catalog";
import type { BusinessFaqCategory, BusinessFaqEntry, BusinessKnowledgeSearchInput, BusinessKnowledgeSearchResult } from "./types";
import { loadBusinessKnowledgeProfile } from "./profile/business-knowledge-profile";

const TOPIC_TO_FAQ_CATEGORY: Partial<Record<string, BusinessFaqCategory[]>> = {
  delivery: ["delivery"],
  service_area: ["delivery"],
  payment: ["payment"],
  currency: ["payment"],
  sav: ["sav", "warranty"],
  return_policy: ["returns"],
  hours: ["hours"],
  faq: ["general", "delivery", "payment", "warranty", "sav", "returns", "hours"],
};

function tokenizeForSearch(message: string): string {
  const raw = message.trim();
  if (!raw) return "";
  const words = raw
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length >= 3);
  if (words.length) return words.slice(0, 6).join(" ");
  return raw.slice(0, 80);
}

function scoreFaqRelevance(entry: BusinessFaqEntry, message: string): number {
  const msg = message.toLowerCase();
  const q = entry.question.toLowerCase();
  let score = 0;
  for (const w of msg.split(/\s+/)) {
    if (w.length >= 3 && q.includes(w)) score += 2;
  }
  return score;
}

export function pickRelevantFaqEntries(
  entries: BusinessFaqEntry[],
  message: string,
  topics: ReturnType<typeof detectKnowledgeTopics>,
  limit = 4,
): BusinessFaqEntry[] {
  const cats = new Set<BusinessFaqCategory>();
  for (const t of topics) {
    for (const c of TOPIC_TO_FAQ_CATEGORY[t] ?? []) cats.add(c);
  }
  if (!cats.size) cats.add("general");

  const pool = entries.filter((e) => cats.has(e.category) || e.category === "general");
  const ranked = (pool.length ? pool : entries)
    .map((e) => ({ e, score: scoreFaqRelevance(e, message) }))
    .sort((a, b) => b.score - a.score);

  const withScore = ranked.filter((r) => r.score > 0);
  const picked = (withScore.length ? withScore : ranked).slice(0, limit).map((r) => r.e);
  return picked;
}

async function searchProductsRpc(
  admin: NonNullable<ReturnType<typeof createAdminClientSafe>>,
  userId: string,
  query: string,
  limit: number,
): Promise<unknown[]> {
  const { data, error } = await admin.rpc("search_catalog_products", {
    p_user_id: userId,
    p_query: query,
    p_limit: limit,
  });

  if (error) {
    console.error("[search_catalog_products]", error);
    const { data: fallback } = await admin
      .from("products")
      .select("id,name,price,category,stock,promo,description,created_at")
      .eq("user_id", userId)
      .ilike("name", `%${query.slice(0, 80)}%`)
      .order("created_at", { ascending: false })
      .limit(limit);
    return fallback ?? [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.product_id,
    name: row.name,
    price: row.price,
    category: row.category,
    stock: row.stock,
    promo: row.promo,
    description: row.description,
  }));
}

/**
 * Recherche unifiée catalogue + settings + FAQ selon message prospect.
 */
export async function searchBusinessKnowledge(
  input: BusinessKnowledgeSearchInput,
): Promise<BusinessKnowledgeSearchResult> {
  const admin = createAdminClientSafe();
  const topics = detectKnowledgeTopics(input.prospectMessage);
  const searchQuery = tokenizeForSearch(input.prospectMessage);
  const maxProducts = input.maxProducts ?? 8;

  if (!admin) {
    return {
      topics,
      profile: { businessName: "Entreprise" },
      products: [],
      faqEntries: [],
      facts: {},
      documentChunks: [],
      matchedCategories: [],
      salesStyleFromSettings: null,
    };
  }

  const knowledgeProfile = await loadBusinessKnowledgeProfile(admin, input.userId);
  const profile = knowledgeProfile.profileSnapshot;
  const facts = knowledgeProfile.facts;
  const faqAll = knowledgeProfile.faqEntries;

  const runCatalog = shouldSearchCatalog(input.prospectMessage);
  const productRows = runCatalog
    ? await searchProductsRpc(admin, input.userId, searchQuery, maxProducts)
    : [];
  const products = runCatalog ? mapDbProductsToCatalogBrief(productRows) : [];
  const matchedCategories = [...new Set(products.map((p) => p.category).filter(Boolean) as string[])];

  const faqEntries = pickRelevantFaqEntries(faqAll, input.prospectMessage, topics, 4);

  let documentChunks: string[] = [];
  if (input.includeVectorChunks && input.queryEmbedding?.length) {
    const { data: chunks } = await admin.rpc("match_document_chunks", {
      p_user_id: input.userId,
      query_embedding: input.queryEmbedding as unknown,
      match_count: 4,
    });
    documentChunks = (chunks ?? [])
      .map((c: { content?: string }) => String(c.content ?? "").slice(0, 900))
      .filter(Boolean);
  }

  return {
    topics,
    profile,
    products,
    faqEntries,
    facts,
    documentChunks,
    matchedCategories,
    salesStyleFromSettings: knowledgeProfile.settings?.sales_style ?? null,
  };
}
