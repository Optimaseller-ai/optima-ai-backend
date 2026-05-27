import type { SalesStrategy } from "@/lib/ai/sales/types";
import type { SellerIntent } from "@/lib/agents/memory/conversation-state";

export type IntentPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL_BUYING_SIGNAL";

export type SalesConversationGoal =
  | "buy"
  | "discover"
  | "compare"
  | "reassure"
  | "delivery"
  | "human_handoff"
  | "support"
  | "chat";

export type HumanEnergyLevel = "calm" | "neutral" | "warm" | "focused" | "urgent";

export type HumanResponseStyle = "micro" | "conversational" | "advisory" | "decisive" | "empathetic";

export type HumanConversationTone = "chaleureux" | "professionnel" | "rassurant" | "efficace" | "détendu";

export type HumanConversationMemory = {
  lastAskedTopics: string[];
  lastPromises: string[];
  interestLevel?: "cold" | "warm" | "hot";
  lastCommercialGoal?: SalesConversationGoal;
  recentHoldPhrases: string[];
  lastUpdatedAt?: number;
};

export type ConversationOrchestratorInput = {
  message: string;
  sellerIntent?: SellerIntent;
  conversationProfile?: import("@/lib/agents/memory/conversation-state").ConversationProfile;
  commercialMemory?: import("@/lib/agents/memory/conversation-state").CommercialMemory;
  humanMemory?: HumanConversationMemory;
  stats?: { turn_count?: number; fatigue?: number; last_active_at?: number };
  silenceMs?: number;
  lang?: "fr" | "en" | "es";
  followupAfterHold?: boolean;
  recentAssistantMessages?: string[];
};

export type ConversationOrchestratorPlan = {
  intentPriority: IntentPriority;
  salesGoal: SalesConversationGoal;
  emotion: string;
  frustration: boolean;
  buyingSignal: boolean;
  silenceNotable: boolean;
  trustLow: boolean;
  tone: HumanConversationTone;
  energy: HumanEnergyLevel;
  responseStyle: HumanResponseStyle;
  salesStrategy?: SalesStrategy;
  nextAction: string;
  memory: HumanConversationMemory;
  forbidHoldPhrases: boolean;
  reasoning: string;
};
