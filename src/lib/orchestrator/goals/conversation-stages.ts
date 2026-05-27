import type { ProspectTurnIntent } from "@/lib/agents/human-behavior/response-orchestrator";
import type { ProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";
import type { ConversationProfile } from "@/lib/agents/memory/conversation-state";
import type { ConversationStage, ProspectTemperature } from "../types";

export function inferConversationStage(args: {
  intent: ProspectTurnIntent;
  temperature: ProspectTemperature;
  turnCount: number;
  emotion: ProspectEmotion;
  hadPurchaseSignal: boolean;
}): ConversationStage {
  if (args.hadPurchaseSignal || args.intent === "achat") return "closing";
  if (args.intent === "objection") return "objection_handling";
  if (args.intent === "plainte") return "objection_handling";
  if (args.temperature === "hot" || args.temperature === "ready") return "closing";
  if (args.temperature === "warm" && args.turnCount >= 3) return "negotiation";
  if (args.intent === "demande_produit" || args.intent === "demande_horaires") return "recommendation";
  if (args.intent === "effort_visite") return "discovery";
  if (args.turnCount === 0) return "greeting";
  if (args.turnCount >= 6) return "followup";
  return "discovery";
}

export function inferProspectTemperature(args: {
  conversationProfile?: ConversationProfile;
  intent: ProspectTurnIntent;
  emotion: ProspectEmotion;
}): ProspectTemperature {
  const buying = args.conversationProfile?.buyingIntent ?? 0;
  if (buying >= 80 || args.intent === "achat") return "ready";
  if (buying >= 55 || args.emotion === "purchase_interest") return "hot";
  if (buying >= 30 || args.intent === "demande_produit" || args.intent === "demande_horaires") return "warm";
  return "cold";
}
