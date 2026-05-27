import type { IntentPriority } from "./types";

const CRITICAL_FR =
  /\b(je\s+veux\s+acheter|acheter\s+maintenant|commander\s+maintenant|je\s+commande|valider\s+la\s+commande|je\s+prends|j['’]en\s+prends|on\s+valide|go\s+pour|je\s+paye|paiement\s+maintenant)\b/i;
const CRITICAL_EN =
  /\b(i\s+want\s+to\s+buy|buy\s+now|place\s+(the\s+)?order|i['']ll\s+take\s+it|checkout\s+now|pay\s+now|let['']s\s+do\s+it)\b/i;
const CRITICAL_ES =
  /\b(quiero\s+comprar|comprar\s+ahora|hago\s+pedido|pago\s+ahora|lo\s+quiero\s+ya)\b/i;

const HIGH_FR =
  /\b(envoyez[- ]?moi\s+le\s+lien|envoie[- ]?moi\s+le\s+lien|lien\s+de\s+paiement|comment\s+payer|mode\s+de\s+paiement|numéro\s+orange|numero\s+orange|mtn\s+money|wave|dispo\s*\?|disponible\s*\?|il\s+en\s+reste|pointure\s+\d|taille\s+\d|je\s+réserve|je\s+reserve)\b/i;
const HIGH_EN =
  /\b(send\s+(me\s+)?the\s+link|payment\s+link|how\s+to\s+pay|in\s+stock\s*\?|available\s*\?|size\s+\d|i['']ll\s+reserve)\b/i;
const HIGH_ES =
  /\b(env[ií]ame\s+el\s+enlace|link\s+de\s+pago|c[oó]mo\s+pagar|disponible\s*\?|talla\s+\d)\b/i;

const LOW_FR = /\b(juste\s+curieux|par\s+hasard|rien\s+de\s+spécial|rien\s+de\s+special|bonjour\s+seulement|salut\s+!?$)\b/i;

/** Priorité d’intention prospect pour cadrer la réponse (pas de « je vérifie » si critique). */
export function inferIntentPriority(message: string): {
  priority: IntentPriority;
  rationale: string;
} {
  const m = String(message ?? "").trim();
  if (!m) return { priority: "LOW", rationale: "message_vide" };

  if (CRITICAL_FR.test(m) || CRITICAL_EN.test(m) || CRITICAL_ES.test(m)) {
    return { priority: "CRITICAL_BUYING_SIGNAL", rationale: "signal_achat_imminent" };
  }

  if (HIGH_FR.test(m) || HIGH_EN.test(m) || HIGH_ES.test(m)) {
    return { priority: "HIGH", rationale: "signal_achat_fort_lien_stock_paiement" };
  }

  if (LOW_FR.test(m) && m.length < 40) {
    return { priority: "LOW", rationale: "échange_léger" };
  }

  if (/\b(je\s+réfléchis|je\s+reflechis|plus\s+tard|demain|pas\s+pressé|pas\s+presse)\b/i.test(m)) {
    return { priority: "NORMAL", rationale: "réflexion_sans_urgence" };
  }

  if (/\b(prix|stock|livraison|commande|modèle|modele|pointure|taille|fcfa|€)\b/i.test(m)) {
    return { priority: "HIGH", rationale: "demande_commerciale_concrète" };
  }

  return { priority: "NORMAL", rationale: "conversation_standard" };
}

export function isCriticalBuyingPriority(priority: IntentPriority): boolean {
  return priority === "CRITICAL_BUYING_SIGNAL";
}
