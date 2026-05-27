import type { CatalogProductBrief } from "@/lib/business-brain/context/catalog-types";
import type { BusinessKnowledgeLang, StockAvailabilityLabel } from "./types";

const LOW_STOCK_THRESHOLD = 5;

export function stockAvailabilityLabel(stock: number | null | undefined): StockAvailabilityLabel {
  if (stock == null || !Number.isFinite(stock)) return "unknown";
  if (stock <= 0) return "out_of_stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "available";
}

export function formatStockLineHuman(
  productName: string,
  stock: number | null | undefined,
  lang: BusinessKnowledgeLang,
): string {
  const label = stockAvailabilityLabel(stock);
  const name = productName.slice(0, 80);
  if (lang === "en") {
    if (label === "available") return `${name}: in stock${typeof stock === "number" ? ` (${stock})` : ""}.`;
    if (label === "low_stock") return `${name}: low stock — only ${stock} left (don't oversell).`;
    if (label === "out_of_stock") return `${name}: currently out of stock.`;
    return `${name}: availability to confirm.`;
  }
  if (lang === "es") {
    if (label === "available") return `${name}: disponible.`;
    if (label === "low_stock") return `${name}: poco stock (${stock}).`;
    if (label === "out_of_stock") return `${name}: agotado.`;
    return `${name}: disponibilidad por confirmar.`;
  }
  if (label === "available") return `${name} : disponible${typeof stock === "number" ? ` (${stock} en stock)` : ""}.`;
  if (label === "low_stock") return `${name} : stock faible — il reste ${stock} (sans insister).`;
  if (label === "out_of_stock") return `${name} : rupture pour le moment.`;
  return `${name} : dispo à confirmer.`;
}

export function formatStockSlice(products: CatalogProductBrief[], lang: BusinessKnowledgeLang): string {
  const lines =
    lang === "en"
      ? ["STOCK (grounded lines only):"]
      : lang === "es"
        ? ["STOCK:"]
        : ["STOCK / DISPONIBILITÉ (lignes ancrées uniquement) :"];

  for (const p of products.slice(0, 4)) {
    lines.push(`- ${formatStockLineHuman(p.name, p.stock ?? null, lang)}`);
  }
  if (!products.length) {
    lines.push(
      lang === "en"
        ? "- No stock lines in knowledge — do not guess counts."
        : "- Pas de ligne stock — ne pas inventer de quantité.",
    );
  }
  return lines.join("\n");
}
