import "server-only";

import type { CatalogProductBrief } from "../context/catalog-types";

export function formatPricingAwarenessBlock(lang: "fr" | "en" | "es", catalog: CatalogProductBrief[]): string {
  const hasPrice = catalog.some((p) => typeof p.priceFcfa === "number" && Number.isFinite(p.priceFcfa));

  const base =
    lang === "en"
      ? [
          "PRICING:",
          "- Prices MUST come from CATALOGUE price lines — never invent FCFA/EUR totals.",
          "- If unsure or missing → say you verify / confirm politely (no hallucination).",
        ]
      : lang === "es"
        ? [
            "PRECIOS:",
            "- Del CATÁLOGO solamente.",
            "- Si falta → confirme sin inventar.",
          ]
        : [
            "PRIX :",
            "- Uniquement les montants présents dans le bloc CATALOGUE (Prix … FCFA).",
            "- Montant inconnu dans les données → « je vérifie / je vous confirme » — aucun prix improvisé.",
          ];

  const sample = hasPrice
    ? lang === "en"
      ? "Catalogue carries explicit prices — cite them verbatim when relevant."
      : "Le bloc catalogue transporte les prix réels ; citez-les tels quels."
    : lang === "en"
      ? "No numeric prices surfaced in snippet — verify before quoting a number."
      : "Pas de lignes prix chiffrées dans l’extrait — vérifier avant de chiffrer.";

  return [...base, `- ${sample}`].join("\n");
}
