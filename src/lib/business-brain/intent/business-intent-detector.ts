import { detectKnowledgeTopics } from "@/lib/business-knowledge/topic-detector";

export type BusinessIntentKind =
  | "service_inquiry"
  | "product_inquiry"
  | "hours_inquiry"
  | "delivery_inquiry"
  | "sav_inquiry"
  | "payment_inquiry"
  | "availability_inquiry"
  | "price_inquiry"
  | "purchase_intent"
  | "social_curiosity"
  | "social_chat"
  | "complaint"
  | "unknown";

export type BusinessIntentResult = {
  intent: BusinessIntentKind;
  topics: string[];
  isCommercialLead: boolean;
  blockSocialOnly: boolean;
  reason: string;
};

const SERVICE_RE =
  /\b(service|services|vous\s+proposez|vous\s+faitez|qu'?est-ce\s+que\s+vous|c'est\s+quoi\s+vos|cest\s+quoi\s+vos|activit[eé]|offre|sp[eé]cialit[eé]|domaine)\b/i;

const PURCHASE_RE = /\b(je\s+prends|je\s+commande|je\s+paie|commander\s+maintenant)\b/i;

export function detectBusinessIntent(message: string): BusinessIntentResult {
  const m = String(message ?? "").trim();
  const lower = m.toLowerCase();
  const topics = detectKnowledgeTopics(m).map(String);

  if (/\b(réclamation|plainte|arnaque|rembours|insatisfait)\b/i.test(lower)) {
    return {
      intent: "complaint",
      topics,
      isCommercialLead: true,
      blockSocialOnly: true,
      reason: "complaint_detected",
    };
  }

  if (PURCHASE_RE.test(lower)) {
    return {
      intent: "purchase_intent",
      topics,
      isCommercialLead: true,
      blockSocialOnly: true,
      reason: "purchase_intent",
    };
  }

  if (SERVICE_RE.test(lower)) {
    return {
      intent: "service_inquiry",
      topics: [...new Set([...topics, "faq"])],
      isCommercialLead: true,
      blockSocialOnly: true,
      reason: "service_inquiry",
    };
  }

  if (topics.includes("hours")) {
    return { intent: "hours_inquiry", topics, isCommercialLead: true, blockSocialOnly: true, reason: "hours" };
  }
  if (topics.includes("delivery")) {
    return { intent: "delivery_inquiry", topics, isCommercialLead: true, blockSocialOnly: true, reason: "delivery" };
  }
  if (topics.includes("sav") || topics.includes("return_policy")) {
    return { intent: "sav_inquiry", topics, isCommercialLead: true, blockSocialOnly: true, reason: "sav" };
  }
  if (topics.includes("payment")) {
    return { intent: "payment_inquiry", topics, isCommercialLead: true, blockSocialOnly: true, reason: "payment" };
  }
  if (topics.includes("stock")) {
    return {
      intent: "availability_inquiry",
      topics,
      isCommercialLead: true,
      blockSocialOnly: true,
      reason: "stock",
    };
  }
  if (topics.includes("price")) {
    return { intent: "price_inquiry", topics, isCommercialLead: true, blockSocialOnly: true, reason: "price" };
  }
  if (topics.includes("product")) {
    return { intent: "product_inquiry", topics, isCommercialLead: true, blockSocialOnly: true, reason: "product" };
  }

  if (/^(salut|bonjour|bonsoir|coucou|hey|cc)\b/i.test(lower) && m.length < 40) {
    return {
      intent: "social_chat",
      topics,
      isCommercialLead: false,
      blockSocialOnly: false,
      reason: "greeting_only",
    };
  }

  if (/\?/.test(m) && m.length < 80 && !SERVICE_RE.test(lower)) {
    return {
      intent: "social_curiosity",
      topics,
      isCommercialLead: false,
      blockSocialOnly: false,
      reason: "short_curiosity",
    };
  }

  return {
    intent: "unknown",
    topics,
    isCommercialLead: topics.length > 0,
    blockSocialOnly: topics.length > 0,
    reason: "default",
  };
}
