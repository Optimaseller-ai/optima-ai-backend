import type { LeadTemperature, ProspectEmotion } from "@/lib/ai/sales/types";

export type FollowupStrategyResult = {
  shouldWait: boolean;
  hintFr: string;
  hintEn: string;
};

/** Relance légère ou pause stratégique — jamais spam. */
export function deriveFollowupStrategy(args: {
  silenceSuggestWait: boolean;
  emotion: ProspectEmotion;
  temperature: LeadTemperature;
  fatigue01: number;
  lang?: "fr" | "en" | "es";
}): FollowupStrategyResult {
  const shouldWait =
    args.silenceSuggestWait ||
    args.emotion === "Hesitant" ||
    (args.fatigue01 > 0.5 && args.temperature !== "Hot");

  if (!shouldWait) {
    return {
      shouldWait: false,
      hintFr: "Pas de relance forcée — répondre au fil de l’eau.",
      hintEn: "No forced follow-up — stay in the flow.",
    };
  }

  return {
    shouldWait: true,
    hintFr:
      args.emotion === "Frustrated"
        ? "Laisser respirer — une seule ligne utile plus tard, sans re-pousser la vente."
        : "Pause stratégique : value-add léger (« je pensais à votre pointure… ») plutôt qu’un rappel commercial.",
    hintEn:
      args.emotion === "Frustrated"
        ? "Give space — one useful line later, no sales stack."
        : "Strategic pause: value-add, not a sales ping.",
  };
}
