import { detectKnowledgeTopics } from "@/lib/business-knowledge/topic-detector";
import type { KnowledgeTopic } from "@/lib/business-knowledge/types";
import { isHesitationSignalMessage } from "./hesitation-signal-engine";
import { detectSocialSignal, isSocialSignalKind } from "./social-signal-detector";

/** Priorité stricte : complaint > payment > order > product > faq > social */
export const CONVERSATION_INTENT_PRIORITY = [
  "complaint",
  "payment",
  "order",
  "product",
  "faq",
  "social",
] as const;

export type ConversationRoutingIntent = (typeof CONVERSATION_INTENT_PRIORITY)[number];

const COMMERCIAL_OVERRIDE =
  /\b(prix|stock|dispo|commander|acheter|livraison|modèle|modele|article|lien|payer|fcfa|€|devis|je\s+veux|besoin\s+d['’']?un|iphone|samsung|téléphone|telephone)\b/i;

const COMPLAINT_RE =
  /\b(réclamation|plainte|rembours|retour|sav|panne|cassé|casse|défectueux|inadmissible|insatisfait|arnaque|déçu|decu|dommage|franchement|fermé|fermée|ferme|c['']était\s+fermé|pas\s+trouvé|déplacement\s+inutile)\b/i;

const VISIT_COMPLAINT_RE =
  /\b(je\s+suis\s+passé|j['']?étais\s+passé|passé\s+hier|venu|venue|boutique|magasin|2\s+fois|deux\s+fois|encore\s+une\s+fois)\b/i;

const ORDER_RE =
  /\b(commander|commande|passer\s+commande|je\s+prends|achat|acheter|checkout|suivi\s+commande|colis|expédition|expedition)\b/i;

const SOCIAL_ONLY_RE =
  /\b(ça\s+va|ca\s+va|comment\s+vas|comment\s+allez|la\s+journée|la\s+forme|tu\s+vas\s+bien|how\s+are\s+you|qué\s+tal|bonsoir|bonjour|salut|coucou|merci|thanks|hmm|hum|euh)\b/i;

const PRODUCT_TOPICS = new Set<KnowledgeTopic>(["product", "price", "stock", "promotion"]);
const PAYMENT_TOPICS = new Set<KnowledgeTopic>(["payment", "currency"]);
const COMPLAINT_TOPICS = new Set<KnowledgeTopic>(["sav", "return_policy"]);
const FAQ_TOPICS = new Set<KnowledgeTopic>(["faq", "hours", "service_area"]);
const ORDER_TOPICS = new Set<KnowledgeTopic>(["delivery"]);

export type ConversationRoutingResult = {
  topics: string[];
  primaryIntent: ConversationRoutingIntent;
  hasBusinessIntent: boolean;
  disableSocialFallback: boolean;
  allowSocialOnlyMode: boolean;
};

function asKnowledgeTopics(topics: string[]): KnowledgeTopic[] {
  const allowed = new Set<string>([
    "product",
    "price",
    "stock",
    "promotion",
    "faq",
    "hours",
    "delivery",
    "sav",
    "return_policy",
    "currency",
    "service_area",
    "payment",
  ]);
  return topics.filter((t): t is KnowledgeTopic => allowed.has(t));
}

/** Topics pour le routage — sans défaut « product » sur messages purement sociaux. */
export function detectRoutingTopics(message: string): string[] {
  const raw = detectKnowledgeTopics(message);
  if (raw.length === 1 && raw[0] === "product" && isLikelySocialOnlyMessage(message)) {
    return [];
  }
  return raw.map(String);
}

export function isLikelySocialOnlyMessage(message: string): boolean {
  const m = String(message ?? "").trim();
  if (!m) return true;
  if (COMMERCIAL_OVERRIDE.test(m) || COMPLAINT_RE.test(m) || VISIT_COMPLAINT_RE.test(m) || ORDER_RE.test(m)) return false;
  const signal = detectSocialSignal(m);
  if (isSocialSignalKind(signal)) return true;
  if (isHesitationSignalMessage(m)) return true;
  if (SOCIAL_ONLY_RE.test(m) && m.length < 120) return true;
  return false;
}

export function resolvePrimaryConversationIntent(args: {
  message: string;
  topics: string[];
}): ConversationRoutingIntent {
  const msg = String(args.message ?? "");
  const kt = asKnowledgeTopics(args.topics);

  if (COMPLAINT_RE.test(msg) || VISIT_COMPLAINT_RE.test(msg) || kt.some((t) => COMPLAINT_TOPICS.has(t))) {
    return "complaint";
  }
  if (kt.some((t) => PAYMENT_TOPICS.has(t))) return "payment";
  if (ORDER_RE.test(msg) || kt.some((t) => ORDER_TOPICS.has(t))) return "order";
  if (kt.some((t) => PRODUCT_TOPICS.has(t))) return "product";
  if (kt.some((t) => FAQ_TOPICS.has(t))) return "faq";
  return "social";
}

/**
 * Routage conversationnel — intent business strictement prioritaire sur social.
 */
export function resolveConversationRouting(args: {
  message: string;
  topics?: string[];
}): ConversationRoutingResult {
  const topics =
    args.topics?.length ? args.topics.map(String) : detectRoutingTopics(args.message);

  const msg = String(args.message ?? "");
  const hasBusinessIntent =
    (topics.length > 0 && !topics.includes("social")) ||
    COMPLAINT_RE.test(msg) ||
    VISIT_COMPLAINT_RE.test(msg) ||
    COMMERCIAL_OVERRIDE.test(msg);
  const disableSocialFallback = hasBusinessIntent;
  const primaryIntent = resolvePrimaryConversationIntent({ message: args.message, topics });

  return {
    topics,
    primaryIntent,
    hasBusinessIntent,
    disableSocialFallback,
    allowSocialOnlyMode: !hasBusinessIntent,
  };
}

export function hasBusinessIntentFromTopics(topics: string[] | undefined): boolean {
  const list = topics ?? [];
  return list.length > 0 && !list.includes("social");
}
