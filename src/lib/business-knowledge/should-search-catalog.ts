/**
 * Évite la recherche catalogue (RPC + embed) sur messages non produit.
 */

const CATALOG_SIGNAL =
  /\b(prix|tarif|combien|coût|cout|budget|stock|dispo|disponible|disponibilité|rupture|épuisé|epuise|produit|article|modèle|modele|catalogue|acheter|commander|iphone|samsung|nike|adidas|promo|remise|fcfa|cfa|€|\$|taille|couleur|ref|référence)\b/i;

export function shouldSearchCatalog(message: string): boolean {
  const m = String(message ?? "").trim();
  if (!m) return false;
  if (CATALOG_SIGNAL.test(m)) return true;
  return false;
}

/** Embedding vectoriel utile seulement si catalogue ou FAQ/documents probables. */
export function shouldRunKnowledgeEmbedding(message: string, topics: string[]): boolean {
  if (shouldSearchCatalog(message)) return true;
  if (topics.some((t) => t === "faq" || t === "sav" || t === "delivery" || t === "return_policy")) {
    return true;
  }
  return false;
}
