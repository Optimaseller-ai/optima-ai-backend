import "server-only";

import type { CatalogProductBrief } from "../context/catalog-types";

/**
 * Instructions stock ancrées catalogue — évite « inventé 3 pièces » hors données.
 */
export function formatStockAwarenessBlock(lang: "fr" | "en" | "es", catalog: CatalogProductBrief[]): string {
  const withStock = catalog.filter((p) => typeof p.stock === "number" && Number.isFinite(p.stock));

  const lines =
    lang === "en"
      ? [
          "STOCK AWARENESS:",
          `- Only cite stock quantities that appear explicitly in CATALOGUE block (e.g. "Stock: N").`,
          `- If absent/unknown → say briefly you’ll confirm / checking — don’t guess counts or colors.`,
          `- Example shapes ONLY if grounded: “We still have 3 pairs.” “Black isn’t showing available right now.”`,
        ]
      : lang === "es"
        ? [
            "STOCK:",
            `- Solo cite stock si aparece número en CATÁLOGO.`,
            `- Si falta datos → dígalo y verifique, sin inventar.`,
          ]
        : [
            "DISPONIBILITÉ STOCK :",
            `- Ne cite un chiffre (ex: « encore 3 pièces ») QUE si une ligne catalogue indique Stock: nombre.`,
            `- Si inconnu dans le bloc → court & humain (« je vérifie », « je confirme ») sans inventaire fictif.`,
            `- Exemples de formes si données réelles : « nous avons encore 3 » / « le noir sort indispo côté stock ».`,
          ];

  const samples = withStock.slice(0, 4).map((p) => {
    const nm = String(p.name ?? "").slice(0, 60);
    return lang === "en" ? `- ${nm}: Stock field = ${p.stock}` : `- ${nm} : champ Stock = ${p.stock}`;
  });

  return [...lines, ...(samples.length ? ["Grounded snapshot (from this prompt’s catalogue):"] : []), ...samples].join("\n");
}
