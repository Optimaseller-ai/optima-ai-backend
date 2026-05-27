import "server-only";

import type { CatalogProductBrief } from "../context/catalog-types";

export function mapDbProductsToCatalogBrief(rows: unknown[]): CatalogProductBrief[] {
  if (!Array.isArray(rows)) return [];
  const out: CatalogProductBrief[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const p = r as Record<string, unknown>;
    const name = String(p.name ?? "").trim();
    if (!name) continue;
    const priceRaw = p.price;
    const priceFcfaRaw =
      typeof priceRaw === "number"
        ? priceRaw
        : typeof priceRaw === "string"
          ? Number(String(priceRaw).replace(/[^\d.-]/g, ""))
          : NaN;
    const priceFcfa = Number.isFinite(priceFcfaRaw) ? Math.round(priceFcfaRaw) : null;
    const stockRaw = p.stock;
    let stock: number | null =
      typeof stockRaw === "number"
        ? stockRaw
        : typeof stockRaw === "string"
          ? Number(stockRaw)
          : null;
    if (!Number.isFinite(stock ?? NaN)) stock = null;
    const description = String(p.description ?? "");

    out.push({
      name: name.slice(0, 240),
      priceFcfa,
      category: typeof p.category === "string" ? p.category.slice(0, 80) : null,
      stock,
      promo: typeof p.promo === "string" ? p.promo.trim().slice(0, 120) : String(p.promo ?? "").trim().slice(0, 120) || undefined,
      descriptionSnippet: description ? description.replace(/\s+/g, " ").trim().slice(0, 200) : undefined,
    });
  }
  return out;
}
