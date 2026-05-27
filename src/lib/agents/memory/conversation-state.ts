/**
 * Types partagés — mémoire comportementale prospect + intention (Optima Seller AI).
 */

import type { ProspectProfile } from "./prospect-profile";
import type { ConversationSocialV2 } from "./conversation-state-v2";
import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";

export type ProspectTone =
  | "hesitant"
  | "aggressive"
  | "rushed"
  | "curious"
  | "loyal"
  | "cold"
  | "warm"
  | "ready_to_buy"
  | "neutral";

export type InterestLevel = "cold" | "warm" | "hot";

export type LanguageStylePreference = "formal" | "neutral" | "warm";

export type ConversationProfile = {
  tone: ProspectTone;
  interestLevel: InterestLevel;
  buyingIntent: number;
  preferredProducts: string[];
  lastTopics: string[];
  preferredLanguageStyle: LanguageStylePreference;
};

export type SellerIntent =
  | "price_inquiry"
  | "stock_inquiry"
  | "delivery_inquiry"
  | "negotiation"
  | "complaint"
  | "curiosity"
  | "purchase_intent"
  | "greeting"
  | "spam"
  | "off_topic"
  | "other";

export type ProductMemory = {
  viewedProducts: string[];
  budgetHint?: string;
  lastMentionedInterest?: string;
  lastProductFocus?: string;
};

export type CommercialMemory = {
  likedProducts: string[];
  objections: string[];
  preferences: string[];
  budgetNotes?: string;
  lastObjectionSnippet?: string;
};

export type SalesSignalsMemory = {
  lastBuyingPhase?: string;
  lastIntentScore?: number;
  objectionKinds?: string[];
  trustLevel01?: number;
  lastUserChars?: number;
  activeLocalHour?: number;
  budgetEcho?: string[];
  preferredEcho?: string[];
  lastUpdatedAt?: number;
};

export type RegionStyle = "standard" | "west_africa";

export type ConversationalEtiquette = {
  prospectEverSentGreeting?: boolean;
  businessPresentationDone?: boolean;
  repliesSinceLastEmoji?: number;
};

export type ProspectEmotionalMemoryKind =
  | "frustrated"
  | "sad_or_distress"
  | "angry"
  | "financial_loss"
  | "tired";

export type ProspectEmotionalMemory = {
  kind: ProspectEmotionalMemoryKind;
  recordedAt: number;
};

export type SellerBehaviorConversationState = {
  language?: "fr" | "en" | "es";
  preferences?: { blacklist?: string[] };
  mood?: string;
  memory?: string[];
  tone_mode?: "chill" | "premium" | "vendeur_soft" | "support_client" | "conversation_naturelle";
  stats?: { turn_count?: number; fatigue?: number; last_active_at?: number };
  conversationalEtiquette?: ConversationalEtiquette;
  conversationProfile?: ConversationProfile;
  lastSellerIntent?: SellerIntent;
  productMemory?: ProductMemory;
  commercialMemory?: CommercialMemory;
  regionStyle?: RegionStyle;
  agent_profile?: unknown;
  prospectProfile?: ProspectProfile;
  prospectLead?: SmartProspectProfile;
  automation?: {
    pipelineStage?: string;
    leadTemperature?: string;
    lastProcessedAt?: number;
    nextFollowupAt?: string | null;
    lastTrigger?: string;
  };
  salesSignalsMemory?: SalesSignalsMemory;
  prospectEmotionalMemory?: ProspectEmotionalMemory;
  socialConversationHabits?: Array<
    "jokes" | "compares" | "late_replies" | "hesitant_buyer" | "direct_style" | "calm_style"
  >;
  conversationSocialV2?: ConversationSocialV2;
  liveOrchestrator?: import("@/lib/orchestrator").ConversationLiveState;
  humanConversationMemory?: import("@/lib/agents/human-conversation").HumanConversationMemory;
  prospectEmotionalState?: import("@/lib/agents/emotional-intelligence").ProspectEmotionalState;
  conversationPersonalityState?: import("@/lib/agents/personality").ConversationPersonalityState;
  socialWarmup?: import("@/lib/agents/social").ConversationSocialWarmup;
  pipelineRuntime?: import("@/lib/chat/pipeline/pipeline-types").ConversationPipelineRuntimeSnapshot;
  socialOnlyMode?: {
    active: boolean;
    signal?: string;
    reason?: string;
    updatedAt?: number;
  };
  humanSalesMemory?: import("./human-sales-memory").HumanSalesMemory;
  emotionalContinuity?: import("@/lib/agents/emotional-intelligence/conversation-emotion-classifier").EmotionalContinuityMemory;
  conversationUi?: import("@/lib/chat/conversation-ui-state").ConversationUiState;
};

export const DEFAULT_CONVERSATION_PROFILE: ConversationProfile = {
  tone: "neutral",
  interestLevel: "cold",
  buyingIntent: 25,
  preferredProducts: [],
  lastTopics: [],
  preferredLanguageStyle: "neutral",
};
