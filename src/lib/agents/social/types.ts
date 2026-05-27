export type SocialSignalKind =
  | "greeting"
  | "greeting_evening"
  | "wellbeing"
  | "wellbeing_followup"
  | "personal_activity"
  | "question_repeat"
  | "thanks"
  | "farewell_night"
  | "farewell_day"
  | "casual_ack"
  | "hesitation"
  | "none";

export type SocialWarmupPhase = "opening" | "engaged" | "commercial_ready";

export type ConversationSocialWarmup = {
  phase: SocialWarmupPhase;
  lastSocialSignal?: SocialSignalKind;
  socialTurnCount: number;
  lastUpdatedAt?: number;
};

export type SocialHumanizationInput = {
  message: string;
  agentName: string;
  businessName: string;
  businessIanaTimezone?: string;
  personaKey?: string | null;
  conversationState?: import("@/lib/agents/memory/conversation-state").SellerBehaviorConversationState;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  lang?: "fr" | "en" | "es";
};

export type SocialRouteDecision = {
  signal: SocialSignalKind;
  isSocialPriority: boolean;
  suppressCommercial: boolean;
  suppressAutomation: boolean;
  suppressHoldPhrases: boolean;
  suppressSalesUrgency: boolean;
  instantReply: string | null;
  warmup: ConversationSocialWarmup;
  reasoning: string;
};

export type SocialSupervisorInsights = {
  activeSignal: SocialSignalKind;
  socialPriority: boolean;
  warmupPhase: SocialWarmupPhase;
  usedInstantReply: boolean;
};
