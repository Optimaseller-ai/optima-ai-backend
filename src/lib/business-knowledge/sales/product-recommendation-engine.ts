import type { CatalogProductBrief } from "@/lib/business-brain/context/catalog-types";
import type { ConversationProfile, ProductMemory } from "@/lib/agents/memory/conversation-state";
import type { ProductRecommendationHint } from "../context/business-context-payload";
import type { CatalogIntelligenceResult } from "../catalog/catalog-intelligence";
import type { BusinessSalesStyle } from "../types";
import { salesStyleProposalFrequency } from "./sales-style-config";

const PHONE_RE = /\b(téléphone|telephone|phone|iphone|samsung|android|mobile)\b/i;
const BUDGET_RE = /\b(budget|pas cher|moins cher|économique|economique|max|maximum)\b/i;

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter((t) => t.length >= 3));
  let n = 0;
  for (const t of b.toLowerCase().split(/\s+/)) {
    if (t.length >= 3 && ta.has(t)) n++;
  }
  return n;
}

function parseBudgetMax(budgetHint?: string): number | null {
  if (!budgetHint) return null;
  const m = budgetHint.replace(/\s/g, "").match(/(\d{4,})/);
  return m ? Number(m[1]) : null;
}

export function generateProductRecommendations(args: {
  prospectMessage: string;
  products: CatalogProductBrief[];
  catalogIntel: CatalogIntelligenceResult;
  productMemory?: ProductMemory;
  conversationProfile?: ConversationProfile;
  salesStyle: BusinessSalesStyle;
}): ProductRecommendationHint[] {
  const { prospectMessage, products, catalogIntel, productMemory, conversationProfile, salesStyle } = args;
  if (salesStyleProposalFrequency(salesStyle) === "low" && conversationProfile?.interestLevel === "cold") {
    return [];
  }

  const msg = prospectMessage.toLowerCase();
  const budgetMax = parseBudgetMax(productMemory?.budgetHint);
  const scored = products.map((p) => {
    let score = tokenOverlap(prospectMessage, p.name) * 3;
    if (p.category && msg.includes(p.category.toLowerCase())) score += 2;
    if (p.promo) score += 1;
    if (typeof p.priceFcfa === "number" && budgetMax && p.priceFcfa <= budgetMax) score += 4;
    if (typeof p.stock === "number" && p.stock > 0) score += 1;
    return { p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const primary = scored[0]?.p;
  if (!primary || scored[0].score < 2) {
    if (PHONE_RE.test(msg) && catalogIntel.bestSellers[0]) {
      return [
        {
          productName: catalogIntel.bestSellers[0].name,
          angle: "Bon compromis autonomie / demande actuelle.",
          confidence: 0.65,
        },
      ];
    }
    return [];
  }

  const hints: ProductRecommendationHint[] = [];
  const alt = scored.find((s) => s.p.name !== primary.name && s.score >= 2)?.p;

  if (PHONE_RE.test(msg) && alt) {
    hints.push({
      productName: alt.name,
      angle: "Alternative à mentionner si autonomie ou budget — une phrase naturelle, pas un catalogue.",
      confidence: 0.72,
    });
  } else if (BUDGET_RE.test(msg) && typeof primary.priceFcfa === "number") {
    const cheaper = scored.find(
      (s) => s.p.name !== primary.name && typeof s.p.priceFcfa === "number" && s.p.priceFcfa < (primary.priceFcfa ?? 0),
    )?.p;
    if (cheaper) {
      hints.push({
        productName: cheaper.name,
        angle: "Plus adapté au budget évoqué — formuler comme conseil interne.",
        confidence: 0.78,
      });
    }
  } else if (alt && conversationProfile?.interestLevel !== "cold") {
    hints.push({
      productName: alt.name,
      angle: "Variante complémentaire si le prospect hésite — une seule suggestion.",
      confidence: 0.6,
    });
  }

  return hints.slice(0, 2);
}

export function formatRecommendationBlock(hints: ProductRecommendationHint[], lang: "fr" | "en" | "es"): string {
  if (!hints.length) return "";
  const header =
    lang === "en"
      ? "STAFF RECOMMENDATION HINTS (one natural sentence max — grounded names only):"
      : "CONSEILS RECOMMANDATION (une phrase naturelle max — noms ancrés uniquement) :";
  const lines = hints.map((h) => `- ${h.productName} : ${h.angle}`);
  return [header, ...lines].join("\n");
}
