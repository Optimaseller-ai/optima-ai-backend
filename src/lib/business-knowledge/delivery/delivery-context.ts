import type { BusinessOperationalFacts } from "../types";

export function buildDeliveryPolicyText(facts: BusinessOperationalFacts): string | undefined {
  const parts = [
    facts.deliveryZonesNotes,
    facts.servedCities?.length ? `Villes : ${facts.servedCities.join(", ")}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : undefined;
}

export function formatDeliveryContextBlock(policy: string | undefined, lang: "fr" | "en" | "es"): string {
  if (!policy?.trim()) {
    return lang === "en"
      ? "DELIVERY: not configured — verify before quoting zones or delays."
      : "LIVRAISON : non configurée — vérifier avant de chiffrer zone ou délai.";
  }
  return lang === "en" ? `DELIVERY POLICY:\n${policy}` : `POLITIQUE LIVRAISON :\n${policy}`;
}
