import type { CatalogProductBrief } from "@/lib/business-brain/context/catalog-types";
import type { ProductHighlight } from "../context/business-context-payload";
import { stockAvailabilityLabel } from "../stock-labels";

const LOW_STOCK_MAX = 5;
const PREMIUM_PRICE_PERCENTILE = 0.75;

export type CatalogIntelligenceResult = {
  mainCategories: string[];
  popular: ProductHighlight[];
  premium: ProductHighlight[];
  lowStock: ProductHighlight[];
  bestSellers: ProductHighlight[];
};

function priceValue(p: CatalogProductBrief): number {
  return typeof p.priceFcfa === "number" && Number.isFinite(p.priceFcfa) ? p.priceFcfa : 0;
}

function hasPromo(p: CatalogProductBrief): boolean {
  return Boolean(p.promo?.trim());
}

export function analyzeCatalogIntelligence(products: CatalogProductBrief[]): CatalogIntelligenceResult {
  if (!products.length) {
    return { mainCategories: [], popular: [], premium: [], lowStock: [], bestSellers: [] };
  }

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean) as string[])].slice(0, 8);

  const withPrice = products.filter((p) => priceValue(p) > 0);
  const priceThreshold =
    withPrice.length > 2
      ? [...withPrice].sort((a, b) => priceValue(a) - priceValue(b))[
          Math.floor(withPrice.length * PREMIUM_PRICE_PERCENTILE)
        ]?.priceFcfa ?? 0
      : 0;

  const lowStock = products
    .filter((p) => stockAvailabilityLabel(p.stock ?? null) === "low_stock")
    .slice(0, 4)
    .map((p) => ({
      name: p.name,
      reason: `Stock faible (${p.stock} restant${(p.stock ?? 0) > 1 ? "s" : ""}) — mention calme, sans urgence agressive.`,
      priceFcfa: p.priceFcfa,
      stock: p.stock,
      promo: p.promo,
    }));

  const premium = products
    .filter((p) => priceValue(p) >= priceThreshold && priceValue(p) > 0)
    .slice(0, 3)
    .map((p) => ({
      name: p.name,
      reason: "Gamme premium / prix haut du catalogue.",
      priceFcfa: p.priceFcfa,
      stock: p.stock,
      promo: p.promo,
    }));

  const withPromo = products.filter(hasPromo).slice(0, 3);
  const popular = (withPromo.length ? withPromo : products.slice(0, 3)).map((p) => ({
    name: p.name,
    reason: hasPromo(p) ? "Promo active — peut être citée naturellement." : "Article récent / visible catalogue.",
    priceFcfa: p.priceFcfa,
    stock: p.stock,
    promo: p.promo,
  }));

  const bestSellers = products
    .filter((p) => stockAvailabilityLabel(p.stock ?? null) === "available" && priceValue(p) > 0)
    .sort((a, b) => priceValue(b) - priceValue(a))
    .slice(0, 3)
    .map((p) => ({
      name: p.name,
      reason: "Souvent demandé — bonne disponibilité actuelle.",
      priceFcfa: p.priceFcfa,
      stock: p.stock,
      promo: p.promo,
    }));

  return {
    mainCategories: categories,
    popular,
    premium,
    lowStock,
    bestSellers,
  };
}

export function formatCatalogIntelligenceBlock(intel: CatalogIntelligenceResult, lang: "fr" | "en" | "es"): string {
  if (!intel.popular.length && !intel.premium.length && !intel.lowStock.length) return "";

  const header =
    lang === "en"
      ? "CATALOG INTELLIGENCE (grounded — cite only these SKUs):"
      : "INTELLIGENCE CATALOGUE (ancré — uniquement ces références) :";

  const lines: string[] = [header];
  if (intel.mainCategories.length) {
    lines.push(`Catégories : ${intel.mainCategories.join(", ")}`);
  }
  const pushGroup = (label: string, items: ProductHighlight[]) => {
    if (!items.length) return;
    lines.push(`${label}:`);
    for (const i of items) {
      lines.push(`- ${i.name} — ${i.reason}${i.promo ? ` (promo: ${i.promo})` : ""}`);
    }
  };
  pushGroup("Populaires / promos", intel.popular);
  pushGroup("Premium", intel.premium);
  pushGroup("Stock limité", intel.lowStock);
  pushGroup("Bien disponibles", intel.bestSellers);
  return lines.join("\n");
}
