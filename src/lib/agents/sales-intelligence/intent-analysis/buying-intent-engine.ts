import "server-only";

import type { SellerIntent } from "@/lib/agents/memory/conversation-state";

/** Phase d’achat « live », plus fine que `SellerIntent` seul. */
export type BuyingIntentPhase =
  | "simple_curiosity"
  | "comparison"
  | "real_interest"
  | "hesitation"
  | "purchase_intent"
  | "imminent_purchase";

export type BuyingIntentSnapshot = {
  phase: BuyingIntentPhase;
  /** 0–100, pour scoring & température commerciale. */
  intentScore: number;
  rationale: string;
};

function norm(s: string): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Détection temps réel d’intention d’achat (heuristique, déterministe).
 * Combine nuances du message + intention vendeur déjà détectée.
 */
export function analyzeBuyingIntent(message: string, sellerIntent: SellerIntent): BuyingIntentSnapshot {
  const m = norm(message);
  if (!m) return { phase: "simple_curiosity", intentScore: 8, rationale: "empty" };

  // Imminent — logistique + paiement concret / validation immédiate
  if (
    /\b(mobile\s*money|momo|mtn\s*momo|orange\s*money|wave|mix\s*by\s*yas)\b/i.test(m) ||
    /\bpayer\s+(en\s+)?(espèce|cash|lique|carte)\b/i.test(m) ||
    /\b(valide|réserve|réserver|finalize|finalize\s+now|checkout)\b/i.test(m) ||
    /\b(envoyez\s+les\s+coordonn[eé]es|vos\s+r[eé]f[eé]rences\s+de\s+paiement)\b/i.test(m)
  ) {
    return { phase: "imminent_purchase", intentScore: 92, rationale: "payment_or_commitment_signals" };
  }
  if (
    /\b(livrez\s+aujourd['\u2019]hui|livraison\s+aujourd['\u2019]hui|same\s*-?\s*day|cette\s+journ[eé]e)\b/i.test(m)
  ) {
    return { phase: "imminent_purchase", intentScore: 88, rationale: "same_day_delivery" };
  }
  if (
    /\b(aujourd['\u2019]hui|ce\s+(soir|matin))\b/i.test(m) &&
    /\b(livrer|livraison|livrez|r[eé]cup[eé]rer|venir\s+récup|récupération)\b/i.test(m)
  ) {
    return { phase: "imminent_purchase", intentScore: 86, rationale: "urgent_delivery_window" };
  }

  // Achat exprimé
  if (
    /\b(je\s+prends|je\s+commande|je\s+valide|je\s+confirme|je\s+l['’]?ach[eè]te|ok\s+je\s+passe|placed?\s+the\s+order)\b/i.test(
      m,
    )
  ) {
    return { phase: "purchase_intent", intentScore: 82, rationale: "explicit_purchase" };
  }
  if (sellerIntent === "purchase_intent") {
    return { phase: "purchase_intent", intentScore: 78, rationale: "seller_intent_purchase" };
  }

  // Hésitation
  if (
    /\b(je\s+r[eé]fl[eé]chi|pas\s+s[uû]r|h[eé]sit|je\s+vous\s+recontacte|apr[eè]s-demain|rappeler\s+plus\s+tard)\b/i.test(m)
  ) {
    return { phase: "hesitation", intentScore: Math.max(28, baselineFromSellerIntent(sellerIntent)), rationale: "hesitation_markers" };
  }

  // Comparaison / concurrence
  if (
    /\b(autre\s+(site|boutique|magasin)|chez\s+\w+|vs\.?|versus|moins\s+cher\s+(ailleurs|sur)|concurrent|internet)\b/i.test(m)
  ) {
    return {
      phase: "comparison",
      intentScore: Math.max(42, baselineFromSellerIntent(sellerIntent) + 6),
      rationale: "comparison_competitor",
    };
  }

  // Curiosité légère
  if (
    /\b(qu['’]?est-ce\s+que\s+vous|vous\s+vendez|c['’]?est\s+quoi|c\s+est\s+quoi|voir\s+votre|catalogue|site)\b/i.test(m) &&
    m.length < 140 &&
    !/\b(prix|combien)\b/i.test(m)
  ) {
    return { phase: "simple_curiosity", intentScore: Math.max(22, baselineFromSellerIntent(sellerIntent)), rationale: "broad_curiosity" };
  }

  // Intérêt concret — prix comme « combien ? » = intérêt moyen+
  if (/\b(combien|prix|coute|co[uû]te|tarif|how\s+much|\u20AC|\$|fcfa|cfa)\b/i.test(m)) {
    const score = /\bcombien\b/i.test(m) && m.length < 48 ? 52 : 58;
    return { phase: "real_interest", intentScore: Math.max(score, baselineFromSellerIntent(sellerIntent)), rationale: "price_or_value_probe" };
  }
  if (sellerIntent === "price_inquiry" || sellerIntent === "stock_inquiry") {
    return { phase: "real_interest", intentScore: Math.max(50, baselineFromSellerIntent(sellerIntent)), rationale: `seller_intent_${sellerIntent}` };
  }

  if (sellerIntent === "delivery_inquiry") {
    return { phase: "real_interest", intentScore: Math.max(55, baselineFromSellerIntent(sellerIntent)), rationale: "delivery_details" };
  }

  // Fallback depuis intention générique
  const fallback = fallbackPhaseFromSellerIntent(sellerIntent, m.length);
  return {
    phase: fallback.phase,
    intentScore: Math.max(fallback.intentScore, baselineFromSellerIntent(sellerIntent)),
    rationale: fallback.rationale,
  };
}

function baselineFromSellerIntent(i: SellerIntent): number {
  switch (i) {
    case "purchase_intent":
      return 75;
    case "price_inquiry":
    case "stock_inquiry":
      return 48;
    case "delivery_inquiry":
      return 52;
    case "negotiation":
      return 50;
    case "curiosity":
      return 32;
    case "complaint":
      return 18;
    default:
      return 24;
  }
}

function fallbackPhaseFromSellerIntent(i: SellerIntent, len: number): BuyingIntentSnapshot {
  if (i === "negotiation") return { phase: "comparison", intentScore: 48, rationale: "negotiation_infers_tradeoff" };
  if (i === "curiosity") return { phase: "simple_curiosity", intentScore: 30 + (len > 80 ? 4 : 0), rationale: "curiosity_fallback" };
  if (i === "complaint") return { phase: "hesitation", intentScore: 20, rationale: "complaint_cools_buying" };
  return { phase: "real_interest", intentScore: 35, rationale: "default_real_interest" };
}
