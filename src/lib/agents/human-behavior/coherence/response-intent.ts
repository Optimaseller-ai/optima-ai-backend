/**
 * Intention principale du tour — une seule réponse ciblée (L13).
 */

export type ResponsePrimaryIntent =
  | "location"
  | "greeting"
  | "wellbeing"
  | "price"
  | "product"
  | "delivery"
  | "purchase"
  | "complaint"
  | "thanks"
  | "general";

const LOCATION_RE =
  /\b(où\s+(êtes|etes|est|se\s+trouve|se\s+trouvent)|vous\s+êtes\s+situ|vous\s+etes\s+situ|tu\s+es\s+situ|situé|situe|situer|situes|adresse|localisation|quartier|ville\s+du\s+magasin|where\s+are\s+you\s+located|where\s+are\s+you|where\s+is\s+(the\s+)?(shop|store)|located\s+in|ubicad|dónde\s+están|donde\s+estan)\b/i;

const GREETING_ONLY =
  /^(bonjour|bonsoir|salut|bjr|bsr|coucou|hello|hi|hey|good\s+(morning|afternoon|evening)|hola|buenos)\b/i;

const WELLBEING_RE =
  /\b(comment\s+(tu\s+vas|vas[- ]?tu|allez|ça\s+va|ca\s+va)|ça\s+va|ca\s+va|how\s+are\s+you|how'?s\s+your\s+day|cómo\s+está|cómo\s+estás|qué\s+tal)\b/i;

const PRICE_RE = /\b(prix|combien|coût|cout|tarif|fcfa|cfa|€|how\s+much|price|precio|cuánto)\b/i;
const PRODUCT_RE = /\b(stock|dispo|disponible|modèle|modele|iphone|samsung|nike|article|catalogue)\b/i;
const DELIVERY_RE = /\b(livraison|livrer|délai|delai|expédition|shipping|delivery|envío|envio)\b/i;
const PURCHASE_RE = /\b(je\s+prends|je\s+commande|acheter|commander|i\s+want\s+to\s+buy|quiero\s+comprar)\b/i;
const COMPLAINT_RE = /\b(arnaque|scam|plainte|réclamation|inadmissible|honte)\b/i;
const THANKS_RE = /\b(merci|thanks|thank\s+you|gracias)\b/i;

export function detectResponsePrimaryIntent(message: string): ResponsePrimaryIntent {
  const raw = String(message ?? "").trim();
  const t = raw.toLowerCase();
  if (!t) return "general";

  if (LOCATION_RE.test(t)) return "location";
  if (THANKS_RE.test(t) && t.length < 40) return "thanks";
  if (COMPLAINT_RE.test(t)) return "complaint";
  if (PURCHASE_RE.test(t)) return "purchase";
  if (DELIVERY_RE.test(t)) return "delivery";
  if (PRICE_RE.test(t)) return "price";
  if (PRODUCT_RE.test(t)) return "product";

  const socialOnly = GREETING_ONLY.test(t) && t.length < 28;
  if (socialOnly) return "greeting";

  if (WELLBEING_RE.test(t) && !PRODUCT_RE.test(t) && !PRICE_RE.test(t)) return "wellbeing";

  return "general";
}

/** Une bulle, réponse directe — pas de small talk empilé. */
export function intentRequiresSingleBubble(intent: ResponsePrimaryIntent): boolean {
  return (
    intent === "location" ||
    intent === "greeting" ||
    intent === "wellbeing" ||
    intent === "thanks" ||
    intent === "price"
  );
}

export function intentMaxBubbles(intent: ResponsePrimaryIntent): number {
  if (intentRequiresSingleBubble(intent)) return 1;
  if (intent === "product" || intent === "purchase" || intent === "delivery") return 2;
  return 2;
}
