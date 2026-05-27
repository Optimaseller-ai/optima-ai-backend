import "server-only";

import type { SalesTemperature } from "../sales-scoring/sales-temperature";
import type { BuyingIntentPhase } from "../intent-analysis/buying-intent-engine";

export type ClosingStrength = "soft" | "medium" | "direct";

export type ClosingSnapshot = {
  strength: ClosingStrength;
  cuesFr: string[];
  cuesEn: string[];
};

export function deriveClosingCue(args: {
  temperature: SalesTemperature;
  buyingPhase: BuyingIntentPhase;
  closingIntensityHint: number;
  fatigueShorten?: boolean;
}): ClosingSnapshot {
  let strength: ClosingStrength = "soft";
  if (args.buyingPhase === "imminent_purchase" || args.temperature === "ready_to_buy" || args.closingIntensityHint >= 3)
    strength = "direct";
  else if (
    args.temperature === "hot" ||
    args.buyingPhase === "purchase_intent" ||
    (args.buyingPhase === "real_interest" && args.closingIntensityHint >= 2)
  )
    strength = "medium";

  if (args.fatigueShorten && strength !== "direct") strength = "soft";

  const cuesFr: Record<ClosingStrength, string[]> = {
    soft: [
      "Je peux déjà préparer votre référence — vous préférez quelle déclinaison ?",
      "Quand vous voulez je vous envoie le détail livraison tranquillement.",
    ],
    medium: [
      "Je peux vous envoyer les infos livraison maintenant comme ça c’est fait.",
      "Si ça vous convient, je peux bloquer votre pointure / couleur côté stock.",
    ],
    direct: [
      "Je peux valider la commande tout de suite si vous voulez — vous réglez comme d’habitude ?",
      "Je réserve votre paire tant qu’elles sont là — vous validez ?",
    ],
  };

  const cuesEn: Record<ClosingStrength, string[]> = {
    soft: ["I can queue that SKU for you — which variant?", "Whenever you’re ready I’ll send shipping details cleanly."],
    medium: ["I can send delivery details now if you want it done.", "If it fits you, I can hold your size/color on our side."],
    direct: [
      "Want me to finalize the order now — same payment route as usual?",
      "I can reserve it while it’s moving — okay to confirm?",
    ],
  };

  return { strength, cuesFr: cuesFr[strength], cuesEn: cuesEn[strength] };
}
