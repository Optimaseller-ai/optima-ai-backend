import "server-only";

import type { BusinessProfileLite, ExtendedBusinessFacts } from "../context/business-brain-args";

/**
 * Livraison : priorité aux faits métier étendus, sinon gabarits sûrs (pas de SLA inventées).
 */
export function formatDeliveryIntelligenceBlock(
  lang: "fr" | "en" | "es",
  profile: BusinessProfileLite,
  facts?: ExtendedBusinessFacts,
): string {
  const custom = facts?.deliveryZonesNotes?.trim();
  if (custom)
    return [
      lang === "en" ? "DELIVERY (CONFIGURED):" : lang === "es" ? "ENVÍOS (DATOS):" : "LIVRAISON (SOURCE MÉTIER FOURNIE) :",
      custom,
      lang === "en"
        ? "Do not contradict this block; never add new cities silently."
        : lang === "es"
          ? "No contradecir ese bloque ni añadir ciudades nuevas sin base."
          : "Ne pas contredire ce bloc ni ajouter de villes non listées.",
    ].join("\n");

  const city = String(profile.city ?? "").trim() || "—";
  const country = String(profile.country ?? "").trim() || "—";

  const lines =
    lang === "en"
      ? [
          "DELIVERY INTELLIGENCE:",
          `- Base geography: ${city}, ${country}.`,
          "- Only promise exact same-day/next-day timelines if DOCUMENT EXCERPTS or operator-configured facts say so.",
          "- Otherwise: credible human phrasing (« I’ll confirm the usual slot we run here » / « Checking our route today ») — no hallucinated durations.",
          "- Example patterns (adapt to real excerpts only): intra-city wording vs inter-city wording.",
        ]
      : lang === "es"
        ? [
            "ENVÍOS:",
            `- Ciudad/base: ${city}, ${country}.`,
            "- Plazos concretos solo si el extracto o datos operativos lo dicen.",
          ]
        : [
            "INTELLIGENCE LIVRAISON :",
            `- Base boutique : ${city}, ${country}.`,
            "- Ne pas affirmer « livré aujourd’hui » / « 24 h » tant que les extraits documents ou la config métier ne le précisent pas.",
            `- Formulations humaines (« je vous confirme le créneau habituel », « je vérifie sur la route du jour ») — pas de délai chiffré inventé.`,
            "- Exemples de style (Douala / Yaoundé) **uniquement** si vos documents/catalogue correspondent — sinon ne pas nommer.",
          ];

  return lines.join("\n");
}
