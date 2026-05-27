import type { CatalogProductBrief } from "./catalog-types";
import type { BusinessFaqEntry, BusinessOperationalFacts, BusinessProfileSnapshot } from "@/lib/business-knowledge/types";
import type { ProfileIdentityForKnowledge } from "@/lib/business-knowledge/types";

/**
 * Structure canonique injectée dans chaque requête LLM — source de vérité business.
 */
export type BusinessKnowledgeBase = {
  business_name: string;
  business_description: string;
  services: string[];
  product_categories: string[];
  products: Array<{ name: string; category?: string | null; priceFcfa?: number | null }>;
  opening_hours: string;
  payment_methods: string;
  delivery_policy: string;
  faq: Array<{ question: string; answer: string }>;
  forbidden_claims: string[];
  communication_style: string;
  /** Vocabulaire autorisé (noms produits, catégories, secteur) — anti-hallucination */
  allowed_vocabulary: string[];
};

const DEFAULT_FORBIDDEN_GENERIC = [
  "forfait mobile",
  "forfaits mobiles",
  "abonnement mobile",
  "box internet",
  "fibre optique",
  "internet fibre",
  "forfait internet",
  "opérateur télécom",
  "réseau mobile",
  "data illimitée",
  "sans engagement mobile",
];

function uniqStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = String(raw ?? "").trim();
    if (!s || s.length < 2) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function buildBusinessKnowledgeBase(input: {
  profile: BusinessProfileSnapshot;
  identity?: ProfileIdentityForKnowledge;
  facts?: BusinessOperationalFacts;
  products: CatalogProductBrief[];
  faqEntries?: BusinessFaqEntry[];
}): BusinessKnowledgeBase {
  const { profile, identity, facts, products, faqEntries } = input;
  const categories = uniqStrings(products.map((p) => p.category).filter(Boolean) as string[]);
  const productNames = products.map((p) => p.name).filter(Boolean).slice(0, 40);

  const offer = identity?.offer?.trim() ?? "";
  const sector = profile.sector?.trim() ?? identity?.sector?.trim() ?? "";
  const goal = identity?.goal?.trim() ?? "";

  const services: string[] = [];
  if (offer) services.push(offer);
  if (sector && !services.some((s) => s.toLowerCase().includes(sector.toLowerCase()))) {
    services.push(`Activité : ${sector}`);
  }
  if (categories.length) {
    services.push(`Catégories catalogue : ${categories.join(", ")}`);
  }
  if (facts?.commercialInstructions?.trim()) {
    services.push(facts.commercialInstructions.trim());
  }

  const business_description = [
    offer,
    sector ? `Secteur : ${sector}` : "",
    goal ? `Objectif : ${goal}` : "",
    facts?.companyImportantNotes?.trim() ?? "",
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 600);

  const allowed_vocabulary = uniqStrings([
    profile.businessName,
    sector,
    offer,
    ...categories,
    ...productNames,
    ...(facts?.servedCities ?? []),
  ]);

  const forbidden_claims = DEFAULT_FORBIDDEN_GENERIC.filter((claim) => {
    const c = claim.toLowerCase();
    return !allowed_vocabulary.some((w) => w.toLowerCase().includes(c) || c.includes(w.toLowerCase()));
  });

  return {
    business_name: profile.businessName,
    business_description: business_description || sector || profile.businessName,
    services: uniqStrings(services),
    product_categories: categories,
    products: products.slice(0, 24).map((p) => ({
      name: p.name,
      category: p.category,
      priceFcfa: p.priceFcfa,
    })),
    opening_hours: facts?.openHoursWeekday?.trim() ?? "",
    payment_methods: facts?.paymentsExtraNote?.trim() ?? "",
    delivery_policy: facts?.deliveryZonesNotes?.trim() ?? "",
    faq: (faqEntries ?? []).slice(0, 6).map((f) => ({ question: f.question, answer: f.answer })),
    forbidden_claims,
    communication_style: facts?.salesStyleNote?.trim() || "humain, sobre, WhatsApp professionnel",
    allowed_vocabulary,
  };
}

export function buildServiceGroundedFallback(kb: BusinessKnowledgeBase, lang: "fr" | "en" | "es"): string {
  const cats = kb.product_categories.slice(0, 4).join(", ");
  if (lang === "en") {
    if (kb.services[0]) return `We mainly do ${kb.services[0].toLowerCase()}.`;
    if (cats) return `We're mainly on ${cats}.`;
    return "Let me double-check what we offer and get back to you.";
  }
  if (kb.services[0]) return `On est surtout sur ${kb.services[0].toLowerCase()}.`;
  if (cats) return `On fait surtout ${cats}.`;
  return "Je vérifie ça pour vous et je vous confirme.";
}

export function formatBusinessKnowledgeBaseBlock(kb: BusinessKnowledgeBase, lang: "fr" | "en" | "es"): string {
  const header =
    lang === "en"
      ? "BUSINESS_CONTEXT (ONLY SOURCE OF TRUTH — never invent outside this):"
      : lang === "es"
        ? "BUSINESS_CONTEXT (única fuente — no inventar):"
        : "BUSINESS_CONTEXT (SEULE SOURCE DE VÉRITÉ — ne rien inventer hors de ça) :";

  const servicesLine =
    kb.services.length > 0
      ? kb.services.map((s) => `- ${s}`).join("\n")
      : lang === "en"
        ? "- (describe only from catalogue/categories below)"
        : "- (décrire uniquement via catalogue/catégories ci-dessous)";

  const categoriesLine = kb.product_categories.length
    ? kb.product_categories.join(", ")
    : lang === "en"
      ? "see product list"
      : "voir liste produits";

  const productsLine = kb.products.length
    ? kb.products
        .slice(0, 12)
        .map((p) => {
          const price = typeof p.priceFcfa === "number" ? ` — ${p.priceFcfa} FCFA` : "";
          const cat = p.category ? ` [${p.category}]` : "";
          return `- ${p.name}${cat}${price}`;
        })
        .join("\n")
    : lang === "en"
      ? "- (no product loaded — say you verify, do not guess)"
      : "- (aucun produit chargé — dire qu'on vérifie, ne pas deviner)";

  const forbidden =
    kb.forbidden_claims.length > 0
      ? kb.forbidden_claims.map((c) => `- ${c}`).join("\n")
      : "- generic telecom/internet plans unless listed above";

  const strict =
    lang === "en"
      ? [
          "STRICT RULE: If info is missing, say you verify. Never guess mobile plans, internet, or products not listed.",
          "When asked « what are your services », answer ONLY from services/categories/products above.",
        ]
      : [
          "RÈGLE STRICTE : si info absente → « je vérifie ». Jamais deviner forfaits, internet, ou produits non listés.",
          "Si on demande « c'est quoi vos services », répondre UNIQUEMENT avec services/catégories/produits ci-dessus.",
        ];

  return [
    header,
    `business_name: ${kb.business_name}`,
    `business_description: ${kb.business_description}`,
    "services:",
    servicesLine,
    `product_categories: ${categoriesLine}`,
    "products (real catalogue):",
    productsLine,
    kb.opening_hours ? `opening_hours: ${kb.opening_hours}` : "",
    kb.payment_methods ? `payment_methods: ${kb.payment_methods}` : "",
    kb.delivery_policy ? `delivery_policy: ${kb.delivery_policy}` : "",
    kb.faq.length
      ? `faq:\n${kb.faq.map((f) => `- Q: ${f.question}\n  A: ${f.answer.slice(0, 200)}`).join("\n")}`
      : "",
    `communication_style: ${kb.communication_style}`,
    "forbidden_claims (NEVER say unless explicitly in catalogue/services above):",
    forbidden,
    ...strict,
  ]
    .filter(Boolean)
    .join("\n");
}
