import "server-only";

import type { ExtendedBusinessFacts } from "../context/business-brain-args";

/**
 * Rendre FAQ / clauses SAV lisibles façon conseiller boutique (sans paragraphe juridique).
 */
export function formatFaqHumanizerBlock(lang: "fr" | "en" | "es", facts?: ExtendedBusinessFacts): string {
  const sav = facts?.savReturnHumanLine?.trim();

  const rules =
    lang === "en"
      ? [
          "FAQ / POLICY — HUMANIZER:",
          `- BAD (robot): “Our return policy stipulates…”`,
          `- GOOD (advisor): “Yes sir — if it doesn’t suit you you can send it back within 48 hours.”`,
          `- 1–2 short sentences max; Monsieur/Madame if FR context matches civility.`,
        ]
      : lang === "es"
        ? [
            "FAQ HUMANO:",
            "- Evitar párrafos legales; 1–2 líneas prácticas.",
          ]
        : [
            "FAQ / CHARTE — STYLE HUMAIN :",
            "- Éviter : « Notre politique de retour autorise… » (ton papier trop propre).",
            "- Privilégier : « Oui Monsieur — vous pouvez retourner sous 48 h si ça ne convient pas. »",
            "- Court, concret ; aligné civilité du fil.",
          ];

  if (sav) {
    rules.push(lang === "en" ? `Return line from operator (trusted): "${sav}"` : `Ligne retour configurée : « ${sav} »`);
  }

  return rules.join("\n");
}
