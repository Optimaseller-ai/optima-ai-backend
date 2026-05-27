import type { ClosingLevel } from "../types";
import type { LeadTemperature, PurchaseIntention, ProspectEmotion } from "@/lib/ai/sales/types";

export type ClosingStrategyResult = {
  level: ClosingLevel;
  linesFr: string[];
  linesEn: string[];
};

/** Niveaux soft / medium / direct — formulations humaines boutique. */
export function deriveClosingStrategy(args: {
  temperature: LeadTemperature;
  intention: PurchaseIntention;
  emotion: ProspectEmotion;
  closingIntensityHint?: number;
  blockHardClose?: boolean;
  fatigueShorten?: boolean;
}): ClosingStrategyResult {
  let level: ClosingLevel = "soft";

  if (
    !args.blockHardClose &&
    (args.intention === "High" || args.temperature === "Hot") &&
    args.emotion !== "Frustrated" &&
    (args.closingIntensityHint ?? 1) >= 3
  ) {
    level = "direct";
  } else if (
    args.intention === "High" ||
    args.temperature === "Hot" ||
    (args.temperature === "Warm" && args.intention === "Medium" && (args.closingIntensityHint ?? 1) >= 2)
  ) {
    level = "medium";
  }

  if (args.emotion === "Frustrated" || args.emotion === "Hesitant") {
    if (level === "direct") level = "medium";
    else if (level === "medium" && args.fatigueShorten) level = "soft";
  }

  if (args.fatigueShorten && level !== "direct") level = "soft";

  const linesFr: Record<ClosingLevel, string[]> = {
    soft: [
      "Je peux vous réserver cela — quelle déclinaison vous convient ?",
      "Quand vous voulez je vous envoie le détail livraison tranquillement.",
    ],
    medium: [
      "Je peux préparer la livraison — vous me confirmez l’adresse ?",
      "Si ça vous va, je bloque votre pointure / couleur côté stock.",
    ],
    direct: [
      "Je peux valider votre commande maintenant — vous réglez comme d’habitude ?",
      "Je réserve votre article tant qu’il est dispo — on valide ?",
    ],
  };

  const linesEn: Record<ClosingLevel, string[]> = {
    soft: [
      "I can hold that for you — which variant works?",
      "Whenever you’re ready I’ll send delivery details calmly.",
    ],
    medium: [
      "I can prep delivery — confirm the address?",
      "If it fits, I’ll hold your size/color on our side.",
    ],
    direct: [
      "I can finalize your order now — same payment route as usual?",
      "I’ll reserve it while it’s moving — okay to confirm?",
    ],
  };

  return { level, linesFr: linesFr[level], linesEn: linesEn[level] };
}
