import "server-only";

import type { BuyingIntentPhase } from "../intent-analysis/buying-intent-engine";
import type { ObjectionHit } from "../objections/objection-detector";

export type ConversationGuidance = {
  headline: string;
  primaryMove:
    | "reassure"
    | "clarify_value"
    | "advance_order"
    | "discovery_light"
    | "repair_trust"
    | "ease_pressure";
};

export function buildConversationGuidance(args: {
  buyingPhase: BuyingIntentPhase;
  objectionHits: ObjectionHit[];
}): ConversationGuidance {
  const ob = args.objectionHits[0];

  if (ob?.kind === "trust") {
    return {
      headline: "Priorité confiance avant tout pitch.",
      primaryMove: "repair_trust",
    };
  }
  if (ob?.kind === "price" || ob?.kind === "competitor_compare") {
    return {
      headline: "Répondre comparaison / prix par valeur + option simple.",
      primaryMove: "clarify_value",
    };
  }
  if (args.buyingPhase === "hesitation" || ob?.kind === "thinking_time") {
    return { headline: "Rassurer, raccourcir les questions.", primaryMove: "reassure" };
  }
  if (args.buyingPhase === "comparison") {
    return { headline: "Cadre valeur propre boutique — sans dénigrer.", primaryMove: "clarify_value" };
  }
  if (args.buyingPhase === "imminent_purchase" || args.buyingPhase === "purchase_intent") {
    return { headline: "Avancer commande avec clarté (prochain pas unique).", primaryMove: "advance_order" };
  }
  if (args.buyingPhase === "simple_curiosity") {
    return { headline: "Accroche courte puis une question ouverte soft.", primaryMove: "discovery_light" };
  }
  return { headline: "Rester conseiller — pas forcé.", primaryMove: "ease_pressure" };
}
