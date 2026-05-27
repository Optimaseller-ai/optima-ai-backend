import "server-only";

import type { BusinessBrainComposeArgs } from "../context/business-brain-args";
import { formatProductMemoryEngineBlock } from "../catalog/product-memory";
import { formatStockAwarenessBlock } from "../stock/stock-awareness";
import { formatPricingAwarenessBlock } from "../pricing/pricing-awareness";
import { formatPromotionEngineBlock } from "../promotions/promotion-engine";
import { formatDeliveryIntelligenceBlock } from "../delivery/delivery-engine";
import { formatPaymentIntelligenceBlock } from "../payment/payment-engine";
import { formatFaqHumanizerBlock } from "../faq/faq-humanizer";
import { formatBusinessHoursEngineBlock } from "../business-hours/business-hours-engine";
import { formatPoliciesSavBlock } from "../policies/policies-sav";
import { formatLocalBusinessContextBlock } from "../context/local-business-context";
import { formatKnowledgePrioritySystemBlock } from "./knowledge-priority";
import { formatAgentConfidenceSystemBlock } from "./agent-confidence";

function formatBusinessIdentityFacts(args: BusinessBrainComposeArgs): string {
  const { lang, profile, facts } = args;
  const tz = profile.businessIanaTimezone?.trim() || "Africa/Douala";
  const contacts = facts?.contactsLine?.trim();

  if (lang === "en") {
    const lines = [
      "REGISTERED FACTS FOR THIS PROMPT SESSION:",
      `- Business: ${profile.businessName}`,
      `- City: ${profile.city ?? "—"}`,
      `- Country: ${profile.country ?? "—"}`,
      `- Timezone: ${tz}`,
      `- Currency assumption for catalogue listing: CFA / XOF labels as written in catalogue lines.`,
      profile.sector ? `- Sector hint: ${profile.sector}` : null,
      contacts ? `- Contact line: ${contacts}` : "- Contact channel: infer only if documented in excerpts.",
    ];
    return lines.filter(Boolean).join("\n");
  }
  if (lang === "es") {
    return [
      "DATOS NEGOCIO:",
      `- Nombre: ${profile.businessName}`,
      `- Ciudad/país: ${profile.city ?? "—"}, ${profile.country ?? "—"}`,
      `- Zona horaria: ${tz}`,
      contacts ? `- Contacto: ${contacts}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "FAITS CENTRAUX ENTREPRISE (session prompt) :",
    `- Nom : ${profile.businessName}`,
    `- Ville / pays : ${profile.city ?? "—"}, ${profile.country ?? "—"}`,
    `- Fuseau : ${tz}`,
    `- Devise affichée catalogue : FCFA / XOF (comme lignes catalogue).`,
    profile.sector ? `- Secteur : ${profile.sector}` : null,
    contacts ? `- Contact configuré : ${contacts}` : "- Contact : uniquement si mentionné dans les extraits / config.",
    args.chunksPresent
      ? "- Des extraits documents sont fournis séparément : prime when they anchor policies."
      : "- Pas d’extrait document hors catalogue dans ce prompt : prudence sur politiques hors stock/prix.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Cerveau business — bloc système dense à injecter pour réduire l’hallucination.
 */
export function composeBusinessBrainPromptBlock(args: BusinessBrainComposeArgs): string {
  const sections = [
    args.lang === "en"
      ? "BUSINESS BRAIN ENGINE — OPTIMA SELLER AI:"
      : args.lang === "es"
        ? "BUSINESS BRAIN ENGINE — OPTIMA:"
        : "BUSINESS BRAIN ENGINE — OPTIMA SELLER IA :",
    "",
    args.lang === "en"
      ? "Goal: the prospect must trust you literally work inside this business — zero improvisation on inventory, tariffs, SLA."
      : args.lang === "es"
        ? "Meta: debe creer que trabaja dentro de ese negocio real — inventar números o plazos está prohibido."
        : "Objectif : le prospect doit croire que vous travaillez vraiment chez cet opérateur — zéro improvisation sur inventaire/tarifs/délais.",
    "",
    formatKnowledgePrioritySystemBlock(args.lang),
    "",
    formatAgentConfidenceSystemBlock(args.lang),
    "",
    formatBusinessIdentityFacts(args),
    "",
    formatPricingAwarenessBlock(args.lang, args.catalog),
    "",
    formatStockAwarenessBlock(args.lang, args.catalog),
    "",
    formatPromotionEngineBlock(args.lang, args.catalog),
    "",
    formatDeliveryIntelligenceBlock(args.lang, args.profile, args.facts),
    "",
    formatPaymentIntelligenceBlock(args.lang, args.profile, args.conversationState, args.facts),
    "",
    formatBusinessHoursEngineBlock(args.lang, args.profile, args.facts),
    "",
    formatPoliciesSavBlock(args.lang, args.facts),
    "",
    formatFaqHumanizerBlock(args.lang, args.facts),
    "",
    formatLocalBusinessContextBlock(args.lang, args.profile, args.conversationState),
    "",
    formatProductMemoryEngineBlock({ conversationState: args.conversationState, lang: args.lang }) ?? "",
  ].filter((x) => x !== "");

  return sections.join("\n");
}
