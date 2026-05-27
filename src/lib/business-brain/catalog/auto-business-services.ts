import type { CatalogProductBrief } from "../context/catalog-types";

export type AutoBusinessServicesSource = "catalog" | "categories" | "offer" | "none";

export type AutoBusinessServicesResult = {
  business_services: string[];
  business_categories: string[];
  business_summary: string;
  source: AutoBusinessServicesSource;
};

type ThemeRule = {
  id: string;
  labelFr: string;
  labelEn: string;
  re: RegExp;
};

const THEME_RULES: ThemeRule[] = [
  {
    id: "phone_accessories",
    labelFr: "accessoires téléphone",
    labelEn: "phone accessories",
    re: /\b(coque|coques|étui|etui|verre\s*trempe|protection|iphone|samsung|xiaomi|redmi|tecno|infinix)\b/i,
  },
  {
    id: "audio_bluetooth",
    labelFr: "écouteurs et audio bluetooth",
    labelEn: "bluetooth audio and earbuds",
    re: /\b(écouteur|ecouteur|earbud|airpods|casque|headphone|bluetooth|audio|buds)\b/i,
  },
  {
    id: "chargers",
    labelFr: "chargeurs et câbles",
    labelEn: "chargers and cables",
    re: /\b(chargeur|chargeurs|câble|cable|usb|adaptateur|power\s*bank|batterie\s*externe)\b/i,
  },
  {
    id: "gadgets",
    labelFr: "gadgets électroniques",
    labelEn: "electronic gadgets",
    re: /\b(gadget|montre|smartwatch|bracelet|enceinte|speaker|lampe|ring\s*light)\b/i,
  },
  {
    id: "phones",
    labelFr: "téléphones et smartphones",
    labelEn: "phones and smartphones",
    re: /\b(téléphone|telephone|smartphone|mobile|android|iphone)\b/i,
  },
  {
    id: "computing",
    labelFr: "informatique et accessoires PC",
    labelEn: "computing accessories",
    re: /\b(pc|ordinateur|laptop|clavier|souris|disque|ssd|ram)\b/i,
  },
];

function norm(s: string) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = String(raw ?? "").trim();
    if (!s || s.length < 2) continue;
    const key = norm(s);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function productHaystack(p: CatalogProductBrief): string {
  return [p.name, p.category, p.promo, p.descriptionSnippet, ...(p.tags ?? [])].filter(Boolean).join(" ");
}

function scoreThemes(products: CatalogProductBrief[]): Array<{ id: string; score: number; labelFr: string; labelEn: string }> {
  const scores = new Map<string, number>();
  for (const p of products) {
    const hay = productHaystack(p);
    for (const rule of THEME_RULES) {
      if (rule.re.test(hay)) {
        scores.set(rule.id, (scores.get(rule.id) ?? 0) + 1);
      }
    }
  }
  return THEME_RULES.map((r) => ({
    id: r.id,
    labelFr: r.labelFr,
    labelEn: r.labelEn,
    score: scores.get(r.id) ?? 0,
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

function normalizeCategoryLabel(raw: string): string {
  const c = String(raw ?? "").trim();
  if (!c) return "";
  const lower = norm(c);
  if (lower.length <= 2) return "";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function buildSummaryFromServices(services: string[], lang: "fr" | "en" | "es"): string {
  const list = services.slice(0, 4);
  if (!list.length) {
    return lang === "en"
      ? "I'll check what's available right now."
      : lang === "es"
        ? "Lo verifico ahora."
        : "Je vérifie les services disponibles actuellement.";
  }
  if (lang === "en") {
    if (list.length === 1) return `We mainly do ${list[0]}.`;
    return `We mainly do ${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}.`;
  }
  if (list.length === 1) return `On fait surtout les ${list[0]}.`;
  if (list.length === 2) return `On fait surtout les ${list[0]} et ${list[1]}.`;
  const head = list.slice(0, -1).join(", ");
  const last = list[list.length - 1];
  return `On fait surtout les ${head} et ${last}.`;
}

/**
 * Déduit services / catégories / résumé business depuis le catalogue admin.
 * Priorité : catalogue (thèmes + noms) → catégories brutes → offer manuel → neutre.
 */
export function inferAutoBusinessServices(input: {
  products: CatalogProductBrief[];
  manualOffer?: string;
  sector?: string;
  lang?: "fr" | "en" | "es";
}): AutoBusinessServicesResult {
  const lang = input.lang ?? "fr";
  const products = Array.isArray(input.products) ? input.products : [];
  const manualOffer = String(input.manualOffer ?? "").trim();
  const sector = String(input.sector ?? "").trim();

  const adminCategories = uniq(
    products.map((p) => normalizeCategoryLabel(String(p.category ?? ""))).filter(Boolean),
  );

  if (products.length > 0) {
    const themes = scoreThemes(products);
    const themeLabels = themes.map((t) => (lang === "en" ? t.labelEn : t.labelFr));

    // Compléter avec catégories admin non couvertes par les thèmes
    const extraCats = adminCategories.filter((c) => {
      const cn = norm(c);
      return !themeLabels.some((t) => norm(t).includes(cn) || cn.includes(norm(t)));
    });

    let business_services = uniq([...themeLabels, ...extraCats.map((c) => c.toLowerCase())]).slice(0, 6);
    let source: AutoBusinessServicesSource = "catalog";

    if (!business_services.length && adminCategories.length) {
      business_services = adminCategories.map((c) => c.toLowerCase());
      source = "categories";
    }

    if (!business_services.length) {
      // Catalogue présent mais sans signal clair — utiliser noms agrégés légers
      const sampleNames = products
        .slice(0, 3)
        .map((p) => p.name)
        .filter(Boolean);
      if (sampleNames.length) {
        business_services = [`vente : ${sampleNames.join(", ")}`];
        source = "catalog";
      }
    }

    const business_summary = buildSummaryFromServices(business_services, lang);

    return {
      business_services,
      business_categories: adminCategories,
      business_summary,
      source,
    };
  }

  // Catalogue vide → offer manuel
  if (manualOffer) {
    const business_services = [manualOffer];
    const business_summary =
      lang === "en"
        ? `We mainly do ${manualOffer.charAt(0).toLowerCase()}${manualOffer.slice(1)}.`
        : `On est surtout sur ${manualOffer.charAt(0).toLowerCase()}${manualOffer.slice(1)}.`;
    return {
      business_services,
      business_categories: adminCategories,
      business_summary,
      source: "offer",
    };
  }

  if (sector) {
    const business_services = [sector.toLowerCase()];
    const business_summary =
      lang === "en" ? `We're in ${sector.toLowerCase()}.` : `On est plutôt sur ${sector.toLowerCase()}.`;
    return {
      business_services,
      business_categories: [],
      business_summary,
      source: "offer",
    };
  }

  return {
    business_services: [],
    business_categories: [],
    business_summary: buildSummaryFromServices([], lang),
    source: "none",
  };
}
