import type { CatalogProductBrief } from "@/lib/business-brain/context/catalog-types";
import type { ProductMemory } from "@/lib/agents/memory/conversation-state";

export type CatalogRecoNeed = {
  wantsPhoto?: boolean;
  wantsGaming?: boolean;
  wantsBattery?: boolean;
  wantsBusiness?: boolean;
  wantsCheap?: boolean;
  wantsHeadphones?: boolean;
  wantsSport?: boolean;
  categoryHint?: string | null;
  brandHint?: string | null;
  budgetMaxFcfa?: number | null;
};

export type CatalogRecoPick = {
  product: CatalogProductBrief;
  score: number;
  reasons: string[];
};

function norm(s: string) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function tokens(text: string): string[] {
  return norm(text)
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length >= 3)
    .slice(0, 16);
}

function parseBudgetMaxFromText(text: string): number | null {
  const n = norm(text);
  if (!n) return null;
  const m = n.replace(/\s/g, "").match(/(\d{4,})/);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

export function inferCatalogNeed(input: { message: string; productMemory?: ProductMemory }): CatalogRecoNeed {
  const m = norm(input.message);
  const budgetHint = input.productMemory?.budgetHint ?? "";
  const budgetMax =
    parseBudgetMaxFromText(m) ??
    parseBudgetMaxFromText(budgetHint) ??
    parseBudgetMaxFromText(String((input.productMemory as any)?.budgetNotes ?? "")) ??
    null;

  const wantsPhoto = /\b(cam(éra|era)|photo|photos|selfie|portrait|instagram|tiktok)\b/i.test(m);
  const wantsGaming = /\b(game|gaming|pubg|codm|call of duty|free fire|fps)\b/i.test(m);
  const wantsBattery = /\b(batterie|autonomie|tient|tienne|longue durée|longue duree)\b/i.test(m);
  const wantsBusiness = /\b(business|pro|travail|boulot|bureau|teams|mail|email)\b/i.test(m);
  const wantsCheap = /\b(pas cher|moins cher|petit budget|budget|économique|economique)\b/i.test(m);
  const wantsHeadphones = /\b(écouteur|ecouteur|casque|earbud|airpods|headphone|buds)\b/i.test(m);
  const wantsSport = /\b(sport|running|course|gym|fitness|sweat|entrainement|entraînement)\b/i.test(m);

  const brand =
    m.match(/\b(iphone|apple|samsung|xiaomi|redmi|tecno|infinix|oppo|realme|nokia)\b/i)?.[1] ?? null;

  const categoryHint = wantsHeadphones
    ? "écouteurs"
    : wantsSport
      ? "sport"
      : null;

  return {
    wantsPhoto,
    wantsGaming,
    wantsBattery,
    wantsBusiness,
    wantsCheap,
    wantsHeadphones,
    wantsSport,
    categoryHint,
    brandHint: brand ? brand.toLowerCase() : null,
    budgetMaxFcfa: budgetMax,
  };
}

function isInStock(p: CatalogProductBrief): boolean {
  if (typeof p.stock !== "number") return true; // unknown -> don't exclude
  return p.stock > 0;
}

function priceScore(priceFcfa: number | null | undefined, budgetMax: number | null): number {
  if (typeof priceFcfa !== "number" || !Number.isFinite(priceFcfa)) return 0;
  if (!budgetMax) return 0;
  if (priceFcfa <= budgetMax) return 4;
  // small penalty if slightly above budget, heavier if far.
  const ratio = priceFcfa / Math.max(1, budgetMax);
  if (ratio <= 1.08) return 1;
  if (ratio <= 1.18) return -1;
  return -3;
}

function overlapScore(message: string, p: CatalogProductBrief): number {
  const mt = tokens(message);
  if (!mt.length) return 0;
  const hay = norm([p.name, p.category, p.promo, p.descriptionSnippet, ...(p.tags ?? [])].filter(Boolean).join(" "));
  let score = 0;
  for (const t of mt) {
    if (hay.includes(t)) score += 1.6;
  }
  return score;
}

export function recommendFromCatalog(args: {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  products: CatalogProductBrief[];
  productMemory?: ProductMemory;
  maxPicks?: number;
  businessPriority?: {
    preferSponsored?: boolean;
    preferHighMargin?: boolean;
    preferNew?: boolean;
    preferBestSellers?: boolean;
  };
}): { picks: CatalogRecoPick[]; need: CatalogRecoNeed; memoryNext?: ProductMemory } {
  const maxPicks = Math.max(1, Math.min(3, args.maxPicks ?? 2));
  const need = inferCatalogNeed({ message: args.message, productMemory: args.productMemory });
  const viewed = new Set((args.productMemory?.viewedProducts ?? []).map((x) => norm(x)).filter(Boolean));

  const scored: CatalogRecoPick[] = [];
  for (const p of args.products ?? []) {
    if (!p?.name) continue;
    if (!isInStock(p)) continue; // priority to in-stock

    const reasons: string[] = [];
    let score = 0;

    // Core relevance: lexical overlap with need + tags + description.
    const ov = overlapScore(args.message, p);
    score += ov;
    if (ov >= 3) reasons.push("match_mots_cles");

    // Budget.
    const ps = priceScore(p.priceFcfa ?? null, need.budgetMaxFcfa ?? null);
    score += ps;
    if (ps >= 3) reasons.push("budget_ok");
    if (ps <= -2) reasons.push("trop_cher_vs_budget");

    // Brand hint.
    if (need.brandHint && norm(p.name).includes(need.brandHint)) {
      score += 2.4;
      reasons.push("marque");
    }

    // Need heuristics via tags/name.
    const hay = norm([p.name, p.descriptionSnippet, ...(p.tags ?? [])].filter(Boolean).join(" "));
    if (need.wantsPhoto && /\b(cam|camera|photo|selfie|portrait)\b/.test(hay)) {
      score += 2.2;
      reasons.push("photo");
    }
    if (need.wantsGaming && /\b(game|gaming|snapdragon|helio|g\d{2}|ram|8gb|12gb)\b/.test(hay)) {
      score += 1.8;
      reasons.push("gaming");
    }
    if (need.wantsBattery && /\b(5000|6000)\b/.test(hay)) {
      score += 1.6;
      reasons.push("batterie");
    }
    if (need.wantsBusiness && /\b(pro|business|bureau|teams|mail|email)\b/.test(hay)) {
      score += 1.2;
      reasons.push("business");
    }
    if (need.wantsCheap && typeof p.priceFcfa === "number") {
      score += 0.4;
      reasons.push("budget");
    }
    if (need.wantsHeadphones && /\b(écouteur|ecouteur|casque|earbud|buds|audio)\b/i.test(hay)) {
      score += 2.8;
      reasons.push("écouteurs");
    }
    if (need.categoryHint && p.category && norm(p.category).includes(norm(need.categoryHint))) {
      score += 2.2;
      reasons.push("catégorie");
    }
    if (need.wantsSport && /\b(sport|bluetooth|sans\s+fil|waterproof|ipx)\b/i.test(hay)) {
      score += 1.8;
      reasons.push("sport");
    }

    // Stock confidence: slightly boost if stock known and >0 (human “dispo”).
    if (typeof p.stock === "number" && p.stock > 0) score += 0.6;

    // Business priorities (soft).
    if (args.businessPriority?.preferSponsored && p.sponsored) score += 0.9;
    if (args.businessPriority?.preferHighMargin && typeof p.margin01 === "number") score += p.margin01 * 0.8;
    if (args.businessPriority?.preferBestSellers && typeof p.popularity01 === "number") score += p.popularity01 * 0.7;
    if (p.promo) score += 0.35;

    // Avoid repetition.
    if (viewed.has(norm(p.name))) score -= 2.5;

    scored.push({ product: p, score: Number(score.toFixed(3)), reasons: Array.from(new Set(reasons)) });
  }

  scored.sort((a, b) => b.score - a.score);
  const picks = scored.filter((x) => x.score >= 1.8).slice(0, maxPicks);

  const memoryNext: ProductMemory | undefined = picks.length
    ? {
        ...(args.productMemory ?? { viewedProducts: [] }),
        viewedProducts: Array.from(
          new Set([...(args.productMemory?.viewedProducts ?? []), ...picks.map((p) => p.product.name)].filter(Boolean)),
        ).slice(-12),
        budgetHint:
          need.budgetMaxFcfa != null
            ? `max ${need.budgetMaxFcfa} FCFA`
            : args.productMemory?.budgetHint,
        lastProductFocus: picks[0]?.product.name ?? args.productMemory?.lastProductFocus,
      }
    : undefined;

  return { picks, need, memoryNext };
}

export function formatRecoHintForPrompt(args: {
  picks: CatalogRecoPick[];
  lang: "fr" | "en" | "es";
}): string {
  const picks = args.picks.slice(0, 3);
  if (!picks.length) return "";
  const header =
    args.lang === "en"
      ? "CATALOG STAFF PICKS (mention 1–3 naturally, no lists):"
      : args.lang === "es"
        ? "RECOMENDACIÓN STAFF (menciona 1–3 natural, sin listas):"
        : "RECO VENDEUR CATALOGUE (1–3 produits max, naturel, pas de liste):";
  const lines = picks.map((x) => {
    const price = typeof x.product.priceFcfa === "number" ? ` ~${x.product.priceFcfa} FCFA` : "";
    const stock =
      typeof x.product.stock === "number"
        ? x.product.stock > 0
          ? " (dispo)"
          : " (rupture)"
        : "";
    return `- ${x.product.name}${price}${stock}`;
  });
  return [header, ...lines].join("\n");
}

