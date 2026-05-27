import "server-only";

import type { ExtendedBusinessFacts } from "../context/business-brain-args";

export function formatPoliciesSavBlock(lang: "fr" | "en" | "es", facts?: ExtendedBusinessFacts): string {
  const custom = facts?.savReturnHumanLine?.trim();
  const lines =
    lang === "en"
      ? [
          "SERVICE / RETURNS:",
          "- No boilerplate disclaimers.",
          "- If excerpts include SAV wording, shorten it like a salesperson would WhatsApp.",
        ]
      : lang === "es"
        ? ["SAV:", "- Breve humano."]
        : [
            "POLITIQUE SAV (ton humain) :",
            "- Pas de cours juridique — une phrase ou deux comme en boutique WhatsApp.",
            "- Si excerpt document indique garantie / délai, les respecter littéralement.",
          ];

  if (custom) lines.push(lang === "en" ? `Operator SAV gist: ${custom}` : `SAV opérateur : ${custom}`);
  return lines.join("\n");
}
