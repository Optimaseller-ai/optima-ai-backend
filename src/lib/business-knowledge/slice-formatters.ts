import "server-only";

import type { CatalogProductBrief } from "@/lib/business-brain/context/catalog-types";
import { formatDeliveryIntelligenceBlock } from "@/lib/business-brain/delivery/delivery-engine";
import { formatBusinessHoursEngineBlock } from "@/lib/business-brain/business-hours/business-hours-engine";
import { formatPoliciesSavBlock } from "@/lib/business-brain/policies/policies-sav";
import { formatPaymentIntelligenceBlock } from "@/lib/business-brain/payment/payment-engine";
import { formatPricingAwarenessBlock } from "@/lib/business-brain/pricing/pricing-awareness";
import { formatPromotionEngineBlock } from "@/lib/business-brain/promotions/promotion-engine";
import type { BusinessProfileLite, ExtendedBusinessFacts } from "@/lib/business-brain/context/business-brain-args";

import { formatStockSlice } from "./stock-labels";
import type {
  BusinessKnowledgeLang,
  BusinessOperationalFacts,
  BusinessProfileSnapshot,
  KnowledgeSlice,
  KnowledgeTopic,
} from "./types";

function toBrainProfile(p: BusinessProfileSnapshot): BusinessProfileLite {
  return {
    businessName: p.businessName,
    sector: p.sector,
    city: p.city,
    country: p.country,
    businessIanaTimezone: p.businessIanaTimezone,
    agentName: p.agentName,
  };
}

function toBrainFacts(f?: BusinessOperationalFacts): ExtendedBusinessFacts | undefined {
  if (!f) return undefined;
  return f;
}

export function filterProductsRelevantToMessage(
  message: string,
  products: CatalogProductBrief[],
  max: number,
): CatalogProductBrief[] {
  const tokens = message
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length >= 3);

  const scored = products.map((p) => {
    const name = String(p.name ?? "").toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (name.includes(t)) score += 2;
    }
    return { p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const matched = scored.filter((s) => s.score > 0).map((s) => s.p);
  const pool = matched.length ? matched : products;
  return pool.slice(0, max);
}

export function formatCompactProductLines(products: CatalogProductBrief[], lang: BusinessKnowledgeLang): string {
  if (!products.length) return "";
  const lines =
    lang === "en"
      ? ["RELEVANT CATALOGUE LINES (only these — do not cite other SKUs):"]
      : lang === "es"
        ? ["LÍNEAS CATÁLOGO PERTINENTES:"]
        : ["LIGNES CATALOGUE PERTINENTES (uniquement celles-ci) :"];

  for (const p of products) {
    const bits = [`- ${p.name}`];
    if (typeof p.priceFcfa === "number" && Number.isFinite(p.priceFcfa)) bits.push(`Prix: ${p.priceFcfa} FCFA`);
    if (p.promo) bits.push(`Promo: ${p.promo}`);
    if (typeof p.stock === "number" && Number.isFinite(p.stock)) bits.push(`Stock: ${p.stock}`);
    if (p.category) bits.push(`Cat: ${p.category}`);
    if (p.descriptionSnippet) bits.push(String(p.descriptionSnippet).slice(0, 120));
    lines.push(bits.join(" | "));
  }
  return lines.join("\n");
}

export function buildIdentitySlice(profile: BusinessProfileSnapshot, lang: BusinessKnowledgeLang): KnowledgeSlice {
  const tz = profile.businessIanaTimezone?.trim() || "Africa/Douala";
  const content =
    lang === "en"
      ? `Business: ${profile.businessName}. City: ${profile.city ?? "—"}. Country: ${profile.country ?? "—"}. TZ: ${tz}. Currency: ${profile.currencyLabel ?? "FCFA/XOF"}.`
      : lang === "es"
        ? `Negocio: ${profile.businessName}. Ciudad: ${profile.city ?? "—"}.`
        : `Entreprise : ${profile.businessName}. Ville : ${profile.city ?? "—"}. Pays : ${profile.country ?? "—"}. Fuseau : ${tz}. Devise : ${profile.currencyLabel ?? "FCFA/XOF"}.`;

  return { kind: "identity", topic: "general", content, grounding: 1 };
}

export function buildTopicSlices(args: {
  topics: KnowledgeTopic[];
  lang: BusinessKnowledgeLang;
  profile: BusinessProfileSnapshot;
  products: CatalogProductBrief[];
  documentChunks: string[];
  facts?: BusinessOperationalFacts;
}): KnowledgeSlice[] {
  const { topics, lang, profile, products, documentChunks, facts } = args;
  const slices: KnowledgeSlice[] = [buildIdentitySlice(profile, lang)];

  const commercialLines = [
    facts?.salesStyleNote
      ? lang === "en"
        ? `Sales style: ${facts.salesStyleNote}`
        : `Style de vente : ${facts.salesStyleNote}`
      : null,
    facts?.commercialInstructions
      ? lang === "en"
        ? `Commercial instructions: ${facts.commercialInstructions.slice(0, 480)}`
        : `Consignes commerciales : ${facts.commercialInstructions.slice(0, 480)}`
      : null,
    facts?.companyImportantNotes
      ? lang === "en"
        ? `Key company notes: ${facts.companyImportantNotes.slice(0, 400)}`
        : `Infos importantes : ${facts.companyImportantNotes.slice(0, 400)}`
      : null,
  ].filter(Boolean);

  if (commercialLines.length) {
    slices.push({
      kind: "faq",
      topic: "general",
      content: commercialLines.join("\n"),
      grounding: 0.92,
    });
  }
  const brainProfile = toBrainProfile(profile);
  const brainFacts = toBrainFacts(facts);

  const needsProducts = topics.some((t) =>
    ["product", "price", "stock", "promotion"].includes(t),
  );

  if (needsProducts && products.length) {
    slices.push({
      kind: "products",
      topic: "product",
      content: formatCompactProductLines(products, lang),
      grounding: 0.95,
    });
  }

  if (topics.includes("price")) {
    slices.push({
      kind: "pricing",
      topic: "price",
      content: formatPricingAwarenessBlock(lang, products),
      grounding: products.some((p) => p.priceFcfa != null) ? 0.9 : 0.4,
    });
  }

  if (topics.includes("stock")) {
    slices.push({
      kind: "stock",
      topic: "stock",
      content: formatStockSlice(products, lang),
      grounding: products.some((p) => p.stock != null) ? 0.9 : 0.35,
    });
  }

  if (topics.includes("promotion")) {
    slices.push({
      kind: "promotions",
      topic: "promotion",
      content: formatPromotionEngineBlock(lang, products),
      grounding: products.some((p) => p.promo) ? 0.85 : 0.4,
    });
  }

  if (topics.includes("delivery") || topics.includes("service_area")) {
    slices.push({
      kind: "delivery",
      topic: "delivery",
      content: formatDeliveryIntelligenceBlock(lang, brainProfile, brainFacts),
      grounding: facts?.deliveryZonesNotes ? 0.85 : 0.5,
    });
    if (facts?.servedCities?.length) {
      slices.push({
        kind: "delivery",
        topic: "service_area",
        content:
          lang === "en"
            ? `Served cities (configured): ${facts.servedCities.join(", ")}.`
            : `Villes desservies (config) : ${facts.servedCities.join(", ")}.`,
        grounding: 0.9,
      });
    }
  }

  if (topics.includes("hours")) {
    slices.push({
      kind: "hours",
      topic: "hours",
      content: formatBusinessHoursEngineBlock(lang, brainProfile, brainFacts),
      grounding: facts?.openHoursWeekday ? 0.9 : 0.55,
    });
  }

  if (topics.includes("payment") || topics.includes("currency")) {
    slices.push({
      kind: "currency",
      topic: topics.includes("payment") ? "payment" : "currency",
      content: formatPaymentIntelligenceBlock(lang, brainProfile, undefined, brainFacts),
      grounding: 0.6,
    });
  }

  if (topics.includes("sav") || topics.includes("return_policy")) {
    slices.push({
      kind: "sav",
      topic: topics.includes("return_policy") ? "return_policy" : "sav",
      content: formatPoliciesSavBlock(lang, brainFacts),
      grounding: facts?.savReturnHumanLine || facts?.returnPolicySummary ? 0.88 : 0.45,
    });
    if (facts?.returnPolicySummary) {
      slices.push({
        kind: "returns",
        topic: "return_policy",
        content: facts.returnPolicySummary,
        grounding: 0.92,
      });
    }
  }

  if (topics.includes("faq") && documentChunks.length) {
    const excerpt = documentChunks
      .slice(0, 2)
      .map((c, i) => `- Extrait ${i + 1}:\n${c.slice(0, 700)}`)
      .join("\n\n");
    slices.push({
      kind: "document_excerpt",
      topic: "faq",
      content: excerpt,
      grounding: 0.75,
    });
  }

  return slices;
}
