import "server-only";

import type { CatalogProductBrief } from "../context/catalog-types";

/** Promotions issues du catalogue uniquement ; consigne anti-spam. */
export function formatPromotionEngineBlock(lang: "fr" | "en" | "es", catalog: CatalogProductBrief[]): string {
  const promos = Array.from(
    new Map(
      catalog
        .map((p) => String(p.promo ?? "").trim())
        .filter((x) => x.length > 1 && x.length < 140)
        .map((x) => [x.toLowerCase(), x]),
    ).values(),
  ).slice(0, 8);

  const lines =
    lang === "en"
      ? [
          "PROMOTION ENGINE:",
          `- Active promos MUST match "Promo:" lines inside CATALOGUE — never invent % or dates.`,
          `- At most ONE promo mention every few turns — natural hook, never stack discounts.`,
          "- If irrelevant to their question → stay silent.",
        ]
      : lang === "es"
        ? [
            "PROMOS:",
            `- Solo líneas Promo del catálogo.`,
            `- Máxima 1 mención natural cada varios turnos.`,
          ]
        : [
            "PROMOTIONS INTELLIGENTES :",
            `- Une promo n’existe que si la ligne catalogue « Promo: » existe — zéro % inventé.`,
            `- Au plus une accroche promotionnelle **naturelle** quelques fois sur la conversation (pas spam).`,
            `- Si hors sujet → ne pas pousser l’offre.`,
          ];

  const block =
    promos.length > 0
      ? `${lang === "en" ? "Catalogue-flagged promo lines:" : lang === "es" ? "Promos en catálogo:" : "Promos présentes dans l’extrait catalogue :"}\n${promos.map((p) => `- ${p}`).join("\n")}`
      : lang === "en"
        ? "(No Promo field in snippet — offer none unless excerpts say so.)"
        : "(Pas de champ Promo dans l’extrait — n’en parlez pas si absent.)";

  return [...lines, "", block].join("\n");
}
