/**
 * Détection de sujets utiles dans le message prospect — pas de LLM requis.
 */

import { shouldSearchCatalog } from "./should-search-catalog";
import type { KnowledgeTopic } from "./types";

const TOPIC_PATTERNS: Record<KnowledgeTopic, RegExp> = {
  product: /\b(produit|article|modèle|modele|catalogue|catalog|ref|référence|iphone|samsung|nike|robe|chaussure|taille|couleur)\b/i,
  price: /\b(prix|tarif|combien|coût|cout|budget|fcfa|cfa|€|\$|remise|promo\s*%|devis)\b/i,
  stock: /\b(stock|dispo|disponible|disponibilité|rupture|épuisé|epuise|reste|combien\s+il\s+reste)\b/i,
  promotion: /\b(promo|promotion|offre|réduction|reduction|solde|black\s+friday)\b/i,
  faq: /\b(comment|pourquoi|est-ce\s+que|puis-je|puis\s+je|garantie|original|authentique|service|services|vous\s+proposez|activit[eé]|offre)\b/i,
  hours: /\b(horaire|horaires|ouvert|ouverte|ouverts|fermé|ferme|dimanche|samedi|aujourd'hui|maintenant|heure|passer\s+à)\b/i,
  delivery: /\b(livraison|livrer|expédition|expedition|délai|delai|transport|retrait|point\s+relai|douala|yaoundé|yaounde)\b/i,
  sav: /\b(sav|service\s+après|apres\s+vente|panne|défaut|defaut|réparation|reparation|garantie)\b/i,
  return_policy: /\b(retour|remboursement|échanger|echanger|repasser|48h|14\s+jours)\b/i,
  currency: /\b(devise|fcfa|cfa|xof|euro|dollar|paiement\s+en)\b/i,
  service_area: /\b(ville|zone|région|region|couvrez|desserv|douala|yaoundé|abidjan|dakar)\b/i,
  payment: /\b(payer|paiement|mobile\s+money|orange\s+money|mtn|wave|carte|virement|acompte)\b/i,
};

export function detectKnowledgeTopics(message: string): KnowledgeTopic[] {
  const m = String(message ?? "").trim();
  if (!m) return [];

  const hits: KnowledgeTopic[] = [];
  for (const [topic, re] of Object.entries(TOPIC_PATTERNS) as [KnowledgeTopic, RegExp][]) {
    if (re.test(m)) hits.push(topic);
  }

  if (!hits.length && shouldSearchCatalog(m)) hits.push("product");
  return [...new Set(hits)];
}

export function topicNeedsProductCatalog(topics: KnowledgeTopic[]): boolean {
  return topics.some((t) => t === "product" || t === "price" || t === "stock" || t === "promotion");
}
