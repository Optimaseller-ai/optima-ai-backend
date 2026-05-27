import "server-only";

import { formatHallucinationGuardBlock } from "./hallucination-guard";
import { formatCatalogIntelligenceBlock } from "./catalog/catalog-intelligence";
import { formatDeliveryContextBlock } from "./delivery/delivery-context";
import { buildFaqMemoryBlock } from "./faq/faq-memory-engine";
import { formatPromotionBlock } from "./promotions/promotion-engine";
import { formatBusinessRulesBlock } from "./rules/business-rules-engine";
import { formatProductMemoryBlock } from "./sales/product-memory-context";
import { formatRecommendationBlock } from "./sales/product-recommendation-engine";
import { formatCompactProductLines } from "./slice-formatters";
import type { BusinessContextPayload } from "./context/business-context-payload";
import type { BusinessKnowledgeLang, KnowledgeSlice, KnowledgeTopic } from "./types";

export type ComposeBusinessKnowledgeArgs = {
  lang: BusinessKnowledgeLang;
  topics: KnowledgeTopic[];
  slices: KnowledgeSlice[];
  unknownDataRisk: boolean;
  enrichmentHints?: string[];
  payload?: BusinessContextPayload;
};

/**
 * Moteur central — assemble le bloc expert injecté dans chaque génération IA.
 */
export function composeBusinessKnowledgePromptBlock(args: ComposeBusinessKnowledgeArgs): string {
  const { lang, topics, slices, unknownDataRisk, enrichmentHints = [], payload } = args;

  const header =
    lang === "en"
      ? "BUSINESS KNOWLEDGE ENGINE — expert employee mode:"
      : "BUSINESS KNOWLEDGE ENGINE — mode conseiller expert :";

  const goal =
    lang === "en"
      ? "You know this business like staff on the floor. Use ONLY grounded blocks below. Human, sober, commercial — never robotic."
      : "Vous connaissez l'entreprise comme un employé. Uniquement les blocs ci-dessous. Humain, sobre, commercial — jamais robot.";

  const topicLine =
    lang === "en" ? `Topics: ${topics.join(", ")}.` : `Sujets : ${topics.join(", ")}.`;

  const sliceBlocks = slices.map((s) => `[${s.kind.toUpperCase()} / ${s.topic}]\n${s.content}`);

  const payloadBlocks: string[] = [];
  if (payload) {
    const identity =
      lang === "en"
        ? `IDENTITY: ${payload.businessName} · ${payload.city ?? "—"}, ${payload.country ?? "—"} · ${payload.currency} · ${payload.sector ?? ""}`
        : `IDENTITÉ : ${payload.businessName} · ${payload.city ?? "—"}, ${payload.country ?? "—"} · ${payload.currency} · ${payload.sector ?? ""}`;

    payloadBlocks.push(identity, payload.salesStyleGuidance);

    if (payload.relevantProducts.length) {
      payloadBlocks.push(formatCompactProductLines(payload.relevantProducts, lang));
    }

    const intelBlock = formatCatalogIntelligenceBlock(payload.catalogIntel, lang);
    if (intelBlock) payloadBlocks.push(intelBlock);

    payloadBlocks.push(formatPromotionBlock(payload.activePromotions, lang));
    payloadBlocks.push(formatDeliveryContextBlock(payload.deliveryPolicy, lang));

    if (payload.returnPolicy) {
      payloadBlocks.push(
        lang === "en" ? `RETURNS: ${payload.returnPolicy}` : `RETOURS : ${payload.returnPolicy}`,
      );
    }
    if (payload.paymentPolicy) {
      payloadBlocks.push(
        lang === "en" ? `PAYMENT: ${payload.paymentPolicy}` : `PAIEMENT : ${payload.paymentPolicy}`,
      );
    }
    if (payload.workingHours) {
      payloadBlocks.push(
        lang === "en" ? `HOURS: ${payload.workingHours}` : `HORAIRES : ${payload.workingHours}`,
      );
    }

    payloadBlocks.push(buildFaqMemoryBlock(payload.faq, lang));
    payloadBlocks.push(formatRecommendationBlock(payload.recommendations, lang));
    payloadBlocks.push(formatProductMemoryBlock(payload.productMemoryLines, lang));
    payloadBlocks.push(formatBusinessRulesBlock(payload.businessRules, lang));

    for (const hint of payload.expertBehaviorHints) {
      payloadBlocks.push(hint);
    }
    if (payload.commercialInstructions) {
      payloadBlocks.push(
        lang === "en"
          ? `COMMERCIAL INSTRUCTIONS: ${payload.commercialInstructions}`
          : `INSTRUCTIONS COMMERCIALES : ${payload.commercialInstructions}`,
      );
    }
    if (payload.companyImportantNotes) {
      payloadBlocks.push(
        lang === "en"
          ? `IMPORTANT: ${payload.companyImportantNotes}`
          : `IMPORTANT : ${payload.companyImportantNotes}`,
      );
    }
  }

  const riskNote = unknownDataRisk
    ? lang === "en"
      ? "DATA GAP: use verification phrases — do not invent."
      : "LACUNE : utiliser « je vérifie » — ne pas inventer."
    : "";

  const hintsBlock =
    enrichmentHints.length > 0
      ? (lang === "en" ? "Hints:\n" : "Indices :\n") + enrichmentHints.map((h) => `- ${h}`).join("\n")
      : "";

  return [
    header,
    goal,
    topicLine,
    "",
    formatHallucinationGuardBlock(lang),
    riskNote,
    "",
    lang === "en" ? "GROUNDED SLICES:" : "TRANCHES ANCRÉES :",
    ...sliceBlocks,
    "",
    lang === "en" ? "EXPERT BUSINESS CONTEXT:" : "CONTEXTE MÉTIER EXPERT :",
    ...payloadBlocks.filter(Boolean),
    hintsBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function runBusinessKnowledgeEngine(args: ComposeBusinessKnowledgeArgs): string {
  return composeBusinessKnowledgePromptBlock(args);
}
