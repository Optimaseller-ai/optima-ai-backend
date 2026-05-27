import type { SellerLanguage } from "@/lib/agents/seller-language";

export function formatHumanSalesSubtletyBlock(lang: SellerLanguage): string {
  if (lang === "en") {
    return "INVISIBLE SALES: advise like a trusted shop peer — options, fit, honesty — zero hard close this turn unless they asked to buy.";
  }
  if (lang === "es") {
    return "VENTA INVISIBLE: consejo de confianza, sin cierre agresivo.";
  }
  return "VENTE SUBTILE : conseiller comme en boutique — options, adéquation, honnêteté — pas de closing agressif sauf demande d’achat explicite.";
}
