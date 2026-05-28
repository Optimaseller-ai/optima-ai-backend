import type { BusinessKnowledgeBase } from "../context/business-knowledge-base";

export type GroundingValidationResult = {
  ok: boolean;
  issues: string[];
  shouldRegenerate: boolean;
};

export type StrictBusinessOutputFilterResult = {
  blocked: boolean;
  issues: string[];
};

const TELECOM_HALLUCINATION =
  /\b(forfait|forfaits|abonnement\s+mobile|box\s+internet|fibre\s+optique|internet\s+mobile|data\s+illimit|sans\s+engagement\s+mobile|opérateur\s+télécom)\b/i;

const SERVICE_RE =
  /\b(service|services|vous\s+proposez|c'est\s+quoi\s+vos|activit[eé])\b/i;
const PRODUCT_RE = /\b(prix|produit|stock|dispo|commander|acheter)\b/i;

function norm(s: string) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function isEchoOfUser(reply: string, userMessage: string): boolean {
  const r = norm(reply);
  const u = norm(userMessage);
  if (!r || !u || r.length < 4) return false;
  if (r === u) return true;
  if (u.length >= 8 && r.includes(u)) return true;
  if (r.length >= 8 && u.includes(r)) return true;
  return false;
}

function isAbsurdMinimal(reply: string, userMessage: string): boolean {
  const r = norm(reply);
  const u = norm(userMessage);
  if (!/^(non|oui|ok|okay|hmm+)$/.test(r)) return false;
  // "non" alone when user asked a real question
  if (u.includes("?") && u.length > 12) return true;
  if (SERVICE_RE.test(u) || PRODUCT_RE.test(u)) return true;
  return false;
}

const HARD_FORBIDDEN_SERVICES =
  /\b(forfaits?\s+mobiles?|box\s+internet|fibre|recharge\s+data|sim|esim|abonnement\s+mobile)\b/i;

function hasCatalogAnchor(reply: string, kb: BusinessKnowledgeBase): boolean {
  const r = norm(reply);
  if (!r) return false;
  const anchors = [
    ...kb.services,
    ...kb.product_categories,
    ...kb.products.map((p) => p.name),
  ]
    .map((x) => norm(x))
    .filter((x) => x.length >= 3);
  if (!anchors.length) return false;
  return anchors.some((a) => r.includes(a) || a.includes(r));
}

export function enforceStrictBusinessOutputFilter(args: {
  reply: string;
  userMessage: string;
  knowledgeBase: BusinessKnowledgeBase;
  businessIntent?: string;
}): StrictBusinessOutputFilterResult {
  const reply = String(args.reply ?? "").trim();
  const issues: string[] = [];
  if (!reply) return { blocked: true, issues: ["empty_reply"] };

  if (HARD_FORBIDDEN_SERVICES.test(reply)) {
    const allowed = args.knowledgeBase.allowed_vocabulary.join(" ").toLowerCase();
    if (!HARD_FORBIDDEN_SERVICES.test(allowed)) {
      issues.push("hard_forbidden_service");
    }
  }

  const serviceInquiry =
    args.businessIntent === "service_inquiry" ||
    /\b(vous\s+vendez\s+quoi|vos\s+services|vous\s+avez\s+quoi|quoi\s+comme\s+produit)\b/i.test(args.userMessage);
  if (serviceInquiry && !hasCatalogAnchor(reply, args.knowledgeBase)) {
    issues.push("service_reply_not_catalog_grounded");
  }

  return { blocked: issues.length > 0, issues };
}

export function validateReplyAgainstBusinessContext(args: {
  reply: string;
  userMessage: string;
  knowledgeBase: BusinessKnowledgeBase;
}): GroundingValidationResult {
  const reply = String(args.reply ?? "").trim();
  const issues: string[] = [];

  if (!reply) {
    return { ok: false, issues: ["empty_reply"], shouldRegenerate: true };
  }

  if (isEchoOfUser(reply, args.userMessage)) {
    issues.push("echo_user_message");
  }

  if (isAbsurdMinimal(reply, args.userMessage)) {
    issues.push("absurd_minimal_reply");
  }

  // Forbidden generic telecom claims unless vocabulary supports it
  if (TELECOM_HALLUCINATION.test(reply)) {
    const allowed = args.knowledgeBase.allowed_vocabulary.join(" ").toLowerCase();
    const hasTelecomInCatalog =
      allowed.includes("forfait") ||
      allowed.includes("internet") ||
      allowed.includes("mobile") ||
      allowed.includes("fibre");
    if (!hasTelecomInCatalog) {
      issues.push("telecom_hallucination");
    }
  }

  for (const forbidden of args.knowledgeBase.forbidden_claims) {
    if (forbidden.length >= 6 && norm(reply).includes(norm(forbidden))) {
      issues.push(`forbidden_claim:${forbidden}`);
    }
  }

  // Product name hallucination: if reply mentions a product-like brand not in catalogue
  const productNames = args.knowledgeBase.products.map((p) => norm(p.name)).filter((n) => n.length >= 4);
  const mentionedModels = reply.match(/\b(iphone\s*\d+|samsung\s+\w+|redmi\s+\w+|tecno\s+\w+)\b/gi) ?? [];
  for (const model of mentionedModels) {
    const m = norm(model);
    const inCatalog = productNames.some((n) => n.includes(m) || m.includes(n.split(" ")[0] ?? ""));
    if (!inCatalog && productNames.length > 0) {
      issues.push(`ungrounded_product:${model}`);
    }
  }

  const shouldRegenerate = issues.some((i) =>
    ["echo_user_message", "absurd_minimal_reply", "telecom_hallucination", "empty_reply"].includes(i) ||
    i.startsWith("forbidden_claim:") ||
    i.startsWith("ungrounded_product:"),
  );

  return {
    ok: issues.length === 0,
    issues,
    shouldRegenerate,
  };
}

export function formatStrictNoHallucinationBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "PRIORITY — NO HALLUCINATION:",
      "- Never invent services, products, prices, stock, or policies.",
      "- If not in BUSINESS_CONTEXT: say you verify or ask one short clarifying question.",
      "- Forbidden unless in context: mobile plans, internet bundles, generic telecom offers.",
    ].join("\n");
  }
  return [
    "PRIORITÉ — ZÉRO HALLUCINATION :",
    "- Ne jamais inventer services, produits, prix, stock ou politiques.",
    "- Si absent du BUSINESS_CONTEXT : dire « je vérifie » ou poser UNE question courte.",
    "- Interdit sauf si dans le contexte : forfaits mobiles, internet, offres télécom génériques.",
  ].join("\n");
}
