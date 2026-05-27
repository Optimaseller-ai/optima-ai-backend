import type { BusinessSalesStyle } from "../types";

export type LegacyAgentSalesStyle = "conseiller" | "closer" | "premium";

const VALID: BusinessSalesStyle[] = ["soft", "balanced", "aggressive", "premium"];

export function normalizeBusinessSalesStyle(raw?: string | null): BusinessSalesStyle | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return VALID.includes(v as BusinessSalesStyle) ? (v as BusinessSalesStyle) : null;
}

export function resolveBusinessSalesStyle(args: {
  settingsStyle?: string | null;
  legacyAgentStyle?: LegacyAgentSalesStyle;
}): BusinessSalesStyle {
  const fromSettings = normalizeBusinessSalesStyle(args.settingsStyle);
  if (fromSettings) return fromSettings;

  if (args.legacyAgentStyle === "premium") return "premium";
  if (args.legacyAgentStyle === "closer") return "aggressive";
  if (args.legacyAgentStyle === "conseiller") return "soft";
  return "balanced";
}

export function salesStyleGuidance(style: BusinessSalesStyle, lang: "fr" | "en" | "es"): string {
  const fr: Record<BusinessSalesStyle, string> = {
    soft:
      "Style soft : écoute d'abord, une seule proposition à la fois, jamais de pression. Relances espacées et humaines.",
    balanced:
      "Style balanced : conseil clair, proposition quand le prospect montre de l'intérêt, closing naturel sans insister.",
    aggressive:
      "Style aggressive : rythme plus direct, propositions franches et relances actives — rester poli et factuel.",
    premium:
      "Style premium : ton soigné, valeur et qualité avant le prix, rareté seulement si données stock réelles.",
  };
  const en: Record<BusinessSalesStyle, string> = {
    soft: "Soft: listen first, one offer at a time, no pressure.",
    balanced: "Balanced: clear advice, propose when interest shows.",
    aggressive: "Aggressive: direct pace, active follow-ups — stay polite.",
    premium: "Premium: refined tone, value before price.",
  };
  if (lang === "en") return en[style];
  if (lang === "es") return en[style];
  return fr[style];
}

export function salesStyleProposalFrequency(style: BusinessSalesStyle): "low" | "medium" | "high" {
  if (style === "soft") return "low";
  if (style === "aggressive") return "high";
  if (style === "premium") return "medium";
  return "medium";
}
