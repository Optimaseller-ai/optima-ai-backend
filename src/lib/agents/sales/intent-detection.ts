import type { SellerIntent } from "@/lib/agents/memory/conversation-state";

function norm(s: string) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Détection d’intention (heuristique, rapide, déterministe côté serveur).
 * À combiner avec le profil prospect pour adapter ton et objectifs.
 */
export function detectSellerIntent(message: string): SellerIntent {
  const m = norm(message);
  if (!m) return "other";

  // Spam / bruit
  if (m.length > 400 && !/[.!?]/.test(m) && m.split(/\s+/).length > 80) return "spam";
  if (/^(http|https):\/\//i.test(m) && m.length < 500) return "spam";
  if (/\b(viagra|casino|crypto|gagner\s+de\s+l'argent|click\s+here)\b/i.test(m)) return "spam";

  if (
    (/^(bonjour|bonsoir|salut|cc|coucou|hello|hi|hey|bjr|bsr)\b/.test(m) ||
      /^(bonne\s+après[\s-]?midi|bonne\s+apres[\s-]?midi|bon\s+matin)\b/.test(m)) &&
    m.length < 48 &&
    !/\b(prix|stock|livraison|acheter|commander)\b/.test(m)
  ) {
    return "greeting";
  }

  if (/\b(arnaque|arnaqueur|scam|remboursement\s+maintenant|tribunal|plainte|réclamation|réclamer|insupportable|honte)\b/i.test(m)) {
    return "complaint";
  }

  if (/\b(remise|rabais|négoc|moins cher|descend|discount|deal|faire\s+un\s+prix)\b/i.test(m)) {
    return "negotiation";
  }

  if (/\b(stock|dispo|disponible|encore|il reste|rupture|épuisé|épuise|in stock|available)\b/i.test(m)) {
    return "stock_inquiry";
  }

  if (/\b(prix|combien|€|\$|fcfa|cfa|tarif|cout|coût|how much|price)\b/i.test(m)) {
    return "price_inquiry";
  }

  if (/\b(livraison|livrer|délai|expédition|transport|adresse|point relais|delivery|ship|shipping)\b/i.test(m)) {
    return "delivery_inquiry";
  }

  if (/\b(je prends|je commande|je valide|je paie|je paye|commander|acheter|ok pour|je veux le|je veux la)\b/i.test(m)) {
    return "purchase_intent";
  }

  if (/\b(c'est quoi|c quoi|explique|pourquoi|intéressant|curieux|vous faites|vous vendez)\b/i.test(m) && m.length < 200) {
    return "curiosity";
  }

  if (
    /\b(météo|film|politique|football|recette|blague|chatgpt|ia\b|intelligence artificielle)\b/i.test(m) &&
    !/\b(prix|stock|livraison|produit|commande)\b/i.test(m)
  ) {
    return "off_topic";
  }

  return "other";
}
