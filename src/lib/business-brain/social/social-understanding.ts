import type { BusinessKnowledgeBase } from "@/lib/business-brain/context/business-knowledge-base";
import { pickHumanGreetingReply } from "@/lib/chat/runtime/human-greeting-engine";

export type SocialSignalKind =
  | "greeting_directed"
  | "appreciation"
  | "acknowledgment"
  | "emotional"
  | "pure_social"
  | "unknown";

export type SocialUnderstanding = {
  kind: SocialSignalKind;
  isPureSocial: boolean;
  isGreetingDirected: boolean;
  isCatalogOverviewInquiry: boolean;
  reason: string;
};

const COMMERCIAL_RE =
  /\b(prix|stock|dispo|disponible|acheter|commander|livraison|produit|produits|article|catalogue|service|services|combien|garantie)\b/i;
const GREETING_RE = /\b(bonsoir|bonjour|salut|hello|cc|coucou|bjr)\b/i;
const APPRECIATION_RE = /\b(merci|super|cool|top|nickel|parfait)\b/i;
const ACK_RE = /^(ok|okay|d['’]?accord|ca marche|ça marche|je vois|reçu|compris)\b/i;
const EMOTIONAL_RE = /(😂|🤣|😅|😢|😭|😡|❤️|lol|mdr|triste|énervé|enerve|frustré|frustre)/i;
const DIRECTED_RE = /\b(jordan|vanessa|boss)\b/i;
const CATALOG_OVERVIEW_RE =
  /\b(vous\s+vendez\s+quoi|vos\s+services|vous\s+avez\s+quoi|quoi\s+comme\s+produit|c['’]?est\s+quoi\s+vos\s+produits|tu\s+vends\s+quoi)\b/i;

function norm(s: string): string {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function seededPick(pool: readonly string[], seed: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return pool[h % pool.length] ?? pool[0] ?? "";
}

export function analyzeSocialUnderstanding(message: string): SocialUnderstanding {
  const n = norm(message);
  if (!n) {
    return {
      kind: "unknown",
      isPureSocial: false,
      isGreetingDirected: false,
      isCatalogOverviewInquiry: false,
      reason: "empty",
    };
  }

  const hasCommercial = COMMERCIAL_RE.test(n);
  const isCatalogOverviewInquiry = CATALOG_OVERVIEW_RE.test(n);
  const isGreeting = GREETING_RE.test(n);
  const isDirected = DIRECTED_RE.test(n);
  const isGreetingDirected = isGreeting && (isDirected || n.length <= 24);

  let kind: SocialSignalKind = "unknown";
  if (isGreetingDirected) kind = "greeting_directed";
  else if (APPRECIATION_RE.test(n)) kind = "appreciation";
  else if (ACK_RE.test(n)) kind = "acknowledgment";
  else if (EMOTIONAL_RE.test(n)) kind = "emotional";

  const isPureSocial = !hasCommercial && !isCatalogOverviewInquiry && kind !== "unknown";
  if (isPureSocial && kind !== "greeting_directed" && kind !== "appreciation" && kind !== "acknowledgment" && kind !== "emotional") {
    kind = "pure_social";
  }

  return {
    kind,
    isPureSocial,
    isGreetingDirected,
    isCatalogOverviewInquiry,
    reason: isCatalogOverviewInquiry ? "catalog_overview" : isPureSocial ? "social_without_commercial_intent" : "mixed_or_unknown",
  };
}

export function pickDirectedGreetingReply(args: {
  message: string;
  lang: "fr" | "en" | "es";
  seed?: string;
  businessName?: string;
  agentName?: string;
  isConversationStart?: boolean;
  timezone?: string;
  browserTimezone?: string | null;
  userTimezone?: string | null;
}): string {
  return pickHumanGreetingReply({
    message: args.message,
    lang: args.lang,
    seed: `${args.seed ?? args.message}|${args.lang}`,
    timezoneInput: {
      sessionTimezone: args.timezone ?? null,
      userTimezone: args.userTimezone ?? null,
      browserTimezone: args.browserTimezone ?? null,
      businessTimezone: args.timezone ?? null,
    },
    businessName: args.businessName,
    agentName: args.agentName,
    isFirstTurn: args.isConversationStart === true,
  });
}

export function isLowHumanQualityReply(args: {
  userMessage: string;
  reply: string;
  social: SocialUnderstanding;
}): boolean {
  const reply = norm(args.reply);
  if (!reply) return true;
  if (!args.social.isPureSocial && !args.social.isGreetingDirected) return false;
  return /^(d['’]?accord|ok|oui|non|ca marche|ça marche)$/.test(reply);
}

export function buildCatalogGroundedReply(args: {
  knowledgeBase: BusinessKnowledgeBase;
  lang: "fr" | "en" | "es";
}): string {
  const categories = args.knowledgeBase.product_categories.slice(0, 4);
  const products = args.knowledgeBase.products.slice(0, 4).map((p) => p.name).filter(Boolean);

  if (args.lang === "en") {
    if (categories.length) return `We mainly sell ${categories.join(", ")}.`;
    if (products.length) return `We mainly have ${products.join(", ")}.`;
    return "We mainly do phone accessories and connected gadgets.";
  }
  if (args.lang === "es") {
    if (categories.length) return `Vendemos sobre todo ${categories.join(", ")}.`;
    if (products.length) return `Tenemos sobre todo ${products.join(", ")}.`;
    return "Estamos sobre todo en accesorios de teléfono y gadgets conectados.";
  }
  if (categories.length) {
    return `On fait surtout ${categories.join(", ")}.`;
  }
  if (products.length) {
    return `On a surtout ${products.join(", ")}.`;
  }
  return "On est surtout sur les accessoires téléphone et gadgets connectés.";
}

