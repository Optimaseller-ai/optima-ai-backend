/**
 * Classification intention prospect (vente) — distincte du routage social.
 */

export type ProspectSalesIntent =
  | "hours_request"
  | "appointment"
  | "complaint"
  | "effort_visit"
  | "product_interest"
  | "negotiation"
  | "availability"
  | "delivery"
  | "support"
  | "greeting"
  | "general";

const HOURS =
  /\b(horaire|horaires|[aà]\s+quelle\s+heure|quelle\s+heure|quel\s+heure|passer\s+[aà]\s+quelle|venir\s+quand|ouvert|ouverte|ferm[eé]|ferme|opening\s+hours)\b/i;

const APPOINTMENT =
  /\b(rendez[- ]?vous|rdv|cr[eé]neau|creneau|prendre\s+rendez|appointment|book\s+a\s+slot)\b/i;

const EFFORT_VISIT =
  /\b(boutique|magasin|je\s+suis\s+pass[eé]|j['']?[eé]tais\s+pass[eé]|pas\s+trouv[eé]|pas\s+trouv[eé]e|attendu|ferm[eé])\b/i;

const COMPLAINT =
  /\b(plainte|r[eé]clamation|reclamation|arnaque|scam|honte|inadmissible|d[eé][çc]u|decu|m[eé]content|mecontent)\b/i;

const DELIVERY =
  /\b(livraison|livrer|exp[eé]dition|expedition|d[eé]lai\s+de\s+livraison|retrait|point\s+relai)\b/i;

const NEGOTIATION = /\b(remise|r[eé]duction|reduction|moins\s+cher|n[eé]gocier|negocier|budget\s+max)\b/i;

const AVAILABILITY = /\b(stock|dispo|disponible|disponibilit[eé]|rupture|[eé]puis[eé]|epuise|en\s+stock)\b/i;

const PRODUCT =
  /\b(prix|tarif|combien|co[uû]t|cout|produit|article|mod[eè]le|modele|catalogue|iphone|samsung|acheter|commander)\b/i;

const SUPPORT =
  /\b(sav|garantie|panne|d[eé]faut|defaut|r[eé]paration|reparation|aide|support|comment\s+faire)\b/i;

const GREETING = /^(bonjour|bonsoir|salut|hello|hi|hey|coucou)\b/i;

export function classifyProspectSalesIntent(message: string): ProspectSalesIntent {
  const m = String(message ?? "").trim();
  if (!m) return "general";
  if (GREETING.test(m) && m.length < 40) return "greeting";
  if (COMPLAINT.test(m)) return "complaint";
  if (HOURS.test(m) && !PRODUCT.test(m)) return "hours_request";
  if (APPOINTMENT.test(m)) return "appointment";
  if (
    EFFORT_VISIT.test(m) &&
    (/\b(pas\s+trouv[eé]|attendu|ferm[eé]|absent)\b/i.test(m) || /\b(boss|yuri|responsable)\b/i.test(m))
  ) {
    return "effort_visit";
  }
  if (DELIVERY.test(m)) return "delivery";
  if (NEGOTIATION.test(m)) return "negotiation";
  if (AVAILABILITY.test(m) && PRODUCT.test(m)) return "availability";
  if (PRODUCT.test(m)) return "product_interest";
  if (SUPPORT.test(m)) return "support";
  return "general";
}

/** Map vers l'intention tour orchestrateur existante. */
export function mapSalesIntentToTurnIntent(
  sales: ProspectSalesIntent,
): import("@/lib/agents/human-behavior/response-orchestrator").ProspectTurnIntent {
  switch (sales) {
    case "hours_request":
    case "appointment":
      return "demande_horaires";
    case "complaint":
      return "plainte";
    case "effort_visit":
      return "effort_visite";
    case "product_interest":
    case "availability":
    case "negotiation":
      return "demande_produit";
    case "delivery":
    case "support":
      return "confusion";
    case "greeting":
      return "salutation";
    default:
      return "simple_discussion";
  }
}
