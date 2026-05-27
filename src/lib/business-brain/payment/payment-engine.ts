import "server-only";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import type { BusinessProfileLite, ExtendedBusinessFacts } from "../context/business-brain-args";

const WAEMU = new Set(["CI", "SN", "ML", "BF", "NE", "TG", "BJ", "GN", "CM"]);

function countryCodeGuess(country?: string): string {
  const raw = String(country ?? "").trim();
  const c = raw.toUpperCase();
  if (c.length === 2) return c;
  const map: Record<string, string> = {
    cameroun: "CM",
    cameroon: "CM",
    "côte d'ivoire": "CI",
    "côte d’ivoire": "CI",
    "cote d ivoire": "CI",
    senegal: "SN",
    sénégal: "SN",
    mali: "ML",
    burkina: "BF",
    niger: "NE",
    togo: "TG",
    benin: "BJ",
    bénin: "BJ",
    guinee: "GN",
    guinée: "GN",
  };
  return map[raw.toLowerCase()] ?? "";
}

/**
 * Moyens de paiement crédibles par bassin ; complétable par métier sans inventer carte si non proposée.
 */
export function formatPaymentIntelligenceBlock(
  lang: "fr" | "en" | "es",
  profile: BusinessProfileLite,
  conversationState?: SellerBehaviorConversationState,
  facts?: ExtendedBusinessFacts,
): string {
  const extra = facts?.paymentsExtraNote?.trim();
  const regionStyle = conversationState?.regionStyle;

  const cc = countryCodeGuess(profile.country);

  const wm =
    WAEMU.has(cc) || regionStyle === "west_africa"
      ? lang === "en"
        ? "Mobile Money ecosystem (Orange/MTN/Wave…) is common — only claim exact rails if excerpts/config list them."
        : lang === "es"
          ? "Orange/MTN/Wave/Mobile Money habituales — solo si extracto/config lo confirma."
          : "Mobile Money / Orange Money / Wave souvent utilisés — ne citez comme acceptés que si document/configuration le précise."
      : lang === "en"
        ? "Mention cards/cash/mobile rails only when documented."
        : lang === "es"
          ? "Solo carte/efectivo/mobile si aparece documentado."
          : "Carte / espèces / mobile : uniquement si document/configuration le précise.";

  const lines =
    lang === "en"
      ? ["PAYMENT INTELLIGENCE:", "- Never invent gateways or fees.", wm]
      : lang === "es"
        ? ["PAGOS:", "- No inventar métodos o comisiones.", wm]
        : ["PAIEMENTS :", "- Aucune méthode inventée.", wm];

  if (extra) lines.push(extra);
  lines.push(
    lang === "en"
      ? "Cash-on-delivery phrasing okay only if that’s consistent with excerpts/policies — otherwise verify."
      : "Paiement à la livraison : uniquement si cohérent avec politique documentée sinon « je vérifie ».",
  );

  return lines.join("\n");
}
