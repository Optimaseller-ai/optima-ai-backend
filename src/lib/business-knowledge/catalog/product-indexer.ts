import "server-only";

import { createAdminClientSafe } from "@/lib/supabase/admin";

export type ProductIndexPayload = {
  userId: string;
  productId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price?: number | null;
  stock?: number | null;
  promo?: string | null;
};

export function buildProductSearchText(p: Omit<ProductIndexPayload, "userId" | "productId">): string {
  return [p.name, p.category, p.promo, p.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

/**
 * Indexe un produit catalogue pour recherche agent (texte ; embedding optionnel plus tard).
 */
export async function indexProductKnowledge(payload: ProductIndexPayload): Promise<{ ok: boolean }> {
  const admin = createAdminClientSafe();
  if (!admin) return { ok: false };

  const searchText = buildProductSearchText(payload);
  const descriptionSnippet = String(payload.description ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

  const row = {
    product_id: payload.productId,
    user_id: payload.userId,
    search_text: searchText,
    name: payload.name.slice(0, 240),
    category: payload.category?.slice(0, 80) ?? null,
    price: payload.price ?? null,
    stock: payload.stock ?? null,
    promo: payload.promo?.slice(0, 120) ?? null,
    description_snippet: descriptionSnippet || null,
    indexed_at: new Date().toISOString(),
  };

  const { error } = await admin.from("product_knowledge_index").upsert(row, { onConflict: "product_id" });
  if (error) {
    console.error("[product_knowledge_index] upsert failed", error);
    return { ok: false };
  }
  return { ok: true };
}

export async function removeProductKnowledgeIndex(productId: string): Promise<void> {
  const admin = createAdminClientSafe();
  if (!admin) return;
  await admin.from("product_knowledge_index").delete().eq("product_id", productId);
}

/** Réindexe tout le catalogue d’un tenant (maintenance). */
export async function reindexAllProductsForUser(userId: string): Promise<number> {
  const admin = createAdminClientSafe();
  if (!admin) return 0;

  const { data: products } = await admin
    .from("products")
    .select("id,name,description,category,price,stock,promo")
    .eq("user_id", userId);

  let n = 0;
  for (const p of products ?? []) {
    const ok = await indexProductKnowledge({
      userId,
      productId: String(p.id),
      name: String(p.name ?? ""),
      description: p.description,
      category: p.category,
      price: p.price != null ? Number(p.price) : null,
      stock: p.stock != null ? Number(p.stock) : null,
      promo: p.promo,
    });
    if (ok.ok) n++;
  }
  return n;
}
