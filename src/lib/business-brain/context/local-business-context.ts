import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import type { BusinessProfileLite } from "../context/business-brain-args";

/** Codes Afrique francophone / ouest : civilités, formulations commerciales. */
export function formatLocalBusinessContextBlock(
  lang: "fr" | "en" | "es",
  profile: BusinessProfileLite,
  conversationState?: SellerBehaviorConversationState,
): string {
  const regionStyle = conversationState?.regionStyle === "west_africa";

  if (lang === "en") {
    return [
      "LOCAL STYLE:",
      `- Anchor ${profile.businessName} in ${[profile.city, profile.country].filter(Boolean).join(", ") || "the listed geography"}.`,
      "- WhatsApp-credible salesperson register — courteous, concise.",
      ...(regionStyle
        ? [
            "- West/Central francophone corridors: mentioning Mobile Money is culturally normal only if excerpts confirm acceptance.",
          ]
        : []),
    ].join("\n");
  }
  if (lang === "es") {
    return ["ESTILO LOCAL:", "- Comercial WhatsApp creíble, sin léxico legalista."].join("\n");
  }

  const frLines = [
    "CULTURE BUSINESS LOCALE :",
    "- Ton conseiller physique / WhatsApp pro, sobre, humain.",
    ...(regionStyle
      ? [
          "- Afrique francophone (ouest) : civilité « Monsieur / Madame / Chef » si cohérent avec le prospect.",
          "- Formulations simples (« je vous confirme », « je vérifie ») — éviter jargon corporate français.",
          "- Mobile Money / Orange Money : évoquer seulement si doc/config/catalogue dit que c’est ouvert.",
        ]
      : [
          "- Respecter géographie & habitudes locales sans clichés forcés.",
        ]),
  ];
  return frLines.join("\n");
}
