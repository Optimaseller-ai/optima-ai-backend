import type { BusinessOperationalFacts, BusinessKnowledgeLang } from "../types";
import type { BusinessRuleHint } from "../context/business-context-payload";

export function deriveBusinessRules(args: {
  facts: BusinessOperationalFacts;
  lang: BusinessKnowledgeLang;
  hasLowStockProducts: boolean;
}): BusinessRuleHint[] {
  const rules: BusinessRuleHint[] = [];
  const { facts, lang, hasLowStockProducts } = args;

  const push = (id: string, ruleFr: string, ruleEn: string, severity: "must" | "should" = "must") => {
    rules.push({
      id,
      severity,
      rule: lang === "en" ? ruleEn : ruleFr,
    });
  };

  push(
    "no_hallucination",
    "Ne jamais inventer prix, stock, délai livraison ou politique retour.",
    "Never invent price, stock, delivery SLA, or return policy.",
  );

  if (facts.paymentsExtraNote?.toLowerCase().includes("avant") || facts.paymentsExtraNote?.toLowerCase().includes("acompte")) {
    push(
      "payment_before_ship",
      "Paiement / acompte avant expédition selon politique configurée.",
      "Payment or deposit before shipping per configured policy.",
    );
  } else {
    push(
      "payment_before_ship_default",
      "Si politique paiement non précisée : ne pas promettre expédition sans confirmation paiement.",
      "If payment policy unclear: do not promise shipment without payment confirmation.",
      "should",
    );
  }

  if (facts.openHoursWeekday) {
    push(
      "hours_respect",
      `Respecter les horaires : ${facts.openHoursWeekday}`,
      `Respect store hours: ${facts.openHoursWeekday}`,
      "should",
    );
  }

  push(
    "no_sunday_delivery_default",
    "Pas de promesse de livraison le dimanche sauf si explicitement configuré.",
    "Do not promise Sunday delivery unless explicitly configured.",
    "should",
  );

  if (facts.returnPolicySummary) {
    push(
      "returns",
      `Retours : ${facts.returnPolicySummary}`,
      `Returns: ${facts.returnPolicySummary}`,
      "should",
    );
  }

  if (hasLowStockProducts) {
    push(
      "low_stock_tone",
      "Stock limité : ton calme (« il en reste quelques-uns »), pas de fausse urgence.",
      "Low stock: calm wording, no fake urgency.",
      "should",
    );
  }

  if (facts.commercialInstructions) {
    push(
      "commercial_instructions",
      facts.commercialInstructions,
      facts.commercialInstructions,
      "must",
    );
  }

  return rules;
}

export function formatBusinessRulesBlock(rules: BusinessRuleHint[], lang: BusinessKnowledgeLang): string {
  if (!rules.length) return "";
  const header =
    lang === "en" ? "BUSINESS RULES (mandatory):" : "RÈGLES MÉTIER (à respecter) :";
  const lines = rules.map((r) => `- [${r.severity}] ${r.rule}`);
  return [header, ...lines].join("\n");
}
