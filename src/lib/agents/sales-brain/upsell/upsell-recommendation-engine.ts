import { deriveSmartProductRecommendations } from "@/lib/agents/sales-intelligence/cross-sell/smart-product-recommendations";
import { inferUpsellFraming } from "@/lib/agents/sales-intelligence/upsell/upsell-framing";
import type { UpsellRecommendation } from "../types";
import type { LeadTemperature, PurchaseIntention } from "@/lib/ai/sales/types";

/** Propose accessoires / alternatives / similaires — une seule piste, ton conseiller. */
export function deriveUpsellRecommendation(args: {
  message: string;
  temperature: LeadTemperature;
  intention: PurchaseIntention;
  blockUpsell?: boolean;
  lang?: "fr" | "en" | "es";
}): UpsellRecommendation | undefined {
  if (args.blockUpsell) return undefined;
  if (args.temperature === "Cold" && args.intention === "Low") return undefined;

  const framing = inferUpsellFraming(args.message);
  const recos = deriveSmartProductRecommendations(args.message);
  const lang = args.lang ?? "fr";

  if (framing.suggestTierStepUp) {
    return {
      kind: "tier_step_up",
      natural: true,
      promptLineFr:
        "Si le budget le permet, la gamme au-dessus tient mieux au quotidien — je peux vous montrer la différence en une phrase.",
      promptLineEn: "If budget allows, the step-up tier lasts longer daily — one-line diff only.",
    };
  }

  const r0 = recos[0];
  if (r0) {
    const lineFr = r0.promptLineFr;
    const lineEn = r0.promptLineEn;
    const kind =
      /\b(accessoire|compl[eé]ment|avec)\b/i.test(lineFr) ? "accessory" : /\b(alternative|sinon|plut[oô]t)\b/i.test(lineFr) ? "alternative" : "similar";
    return {
      kind,
      natural: true,
      promptLineFr: `Conseil naturel (une fois) : ${lineFr}`,
      promptLineEn: `Natural advisor line (once): ${lineEn}`,
    };
  }

  if (args.intention !== "Low" && args.temperature !== "Cold") {
    return {
      kind: "accessory",
      natural: true,
      promptLineFr:
        lang === "en"
          ? "Clients often add a small complementary piece — only if it fits what you said."
          : "Beaucoup de clients ajoutent un petit complément — seulement si ça colle à ce que vous cherchez.",
      promptLineEn: "Many clients add a small complement — only if it matches your need.",
    };
  }

  return undefined;
}
