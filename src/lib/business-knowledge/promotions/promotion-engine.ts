import type { CatalogProductBrief } from "@/lib/business-brain/context/catalog-types";
import type { ActivePromotion } from "../context/business-context-payload";

export function extractActivePromotions(products: CatalogProductBrief[]): ActivePromotion[] {
  const out: ActivePromotion[] = [];
  for (const p of products) {
    const promo = p.promo?.trim();
    if (!promo) continue;
    out.push({
      label: promo,
      productName: p.name,
      detail: typeof p.priceFcfa === "number" ? `${p.priceFcfa} FCFA` : undefined,
    });
    if (out.length >= 6) break;
  }
  return out;
}

export function formatPromotionBlock(promos: ActivePromotion[], lang: "fr" | "en" | "es"): string {
  if (!promos.length) {
    return lang === "en"
      ? "PROMOTIONS: none flagged in catalog — do not invent discounts."
      : "PROMOS : aucune ligne promo catalogue — ne pas inventer de réduction.";
  }

  const header =
    lang === "en"
      ? "ACTIVE PROMOTIONS (mention naturally once if relevant — no spam):"
      : "PROMOTIONS ACTIVES (citer une fois si pertinent — pas de spam) :";

  const lines = promos.map((p) => {
    const base = p.productName ? `${p.productName} : ${p.label}` : p.label;
    return `- ${base}${p.detail ? ` (${p.detail})` : ""}`;
  });
  return [header, ...lines].join("\n");
}
