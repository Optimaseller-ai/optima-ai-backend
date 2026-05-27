import "server-only";

import type { CatalogProductBrief } from "../context/catalog-types";

export function mapDbProductsToCatalogBrief(rows: unknown[]): CatalogProductBrief[] {
  if (!Array.isArray(rows)) return [];
  const out: CatalogProductBrief[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const p = r as Record<string, unknown>;
    const id = p.id != null ? String(p.id) : undefined;
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
      id,
      name: name.slice(0, 240),
      priceFcfa,
      category: typeof p.category === "string" ? p.category.slice(0, 80) : null,
      stock,
      promo: typeof p.promo === "string" ? p.promo.trim().slice(0, 120) : String(p.promo ?? "").trim().slice(0, 120) || undefined,
      descriptionSnippet: description ? description.replace(/\s+/g, " ").trim().slice(0, 200) : undefined,
      tags: Array.isArray(p.tags) ? (p.tags.map((t) => String(t)).filter(Boolean).slice(0, 12) as string[]) : null,
      thumbnailUrl: typeof p.thumbnail_url === "string" ? p.thumbnail_url : typeof p.thumbnailUrl === "string" ? p.thumbnailUrl : null,
      imageUrls: Array.isArray(p.image_urls)
        ? (p.image_urls.map((u) => String(u)).filter(Boolean).slice(0, 6) as string[])
        : Array.isArray(p.images)
          ? (p.images.map((u) => String(u)).filter(Boolean).slice(0, 6) as string[])
          : null,
      popularity01:
        typeof p.popularity01 === "number"
          ? p.popularity01
          : typeof p.popularity === "number"
            ? Math.max(0, Math.min(1, p.popularity))
            : null,
      margin01:
        typeof p.margin01 === "number"
          ? p.margin01
          : typeof p.margin === "number"
            ? Math.max(0, Math.min(1, p.margin))
            : null,
      sponsored: typeof p.sponsored === "boolean" ? p.sponsored : null,
    });
  }
  return out;
}
