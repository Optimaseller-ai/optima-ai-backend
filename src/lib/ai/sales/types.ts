export type LeadTemperature = "Cold" | "Warm" | "Hot";
export type ProspectEmotion = "Frustrated" | "Excited" | "Hesitant" | "Neutral" | "Joking" | "Skeptical";
export type TrustLevel = "Low" | "Medium" | "High";
export type PurchaseIntention = "Low" | "Medium" | "High";

export type SalesStrategy =
  | "SOFT_CONVERSATION"
  | "PRODUCT_GUIDANCE"
  | "TRUST_BUILDING"
  | "OBJECTION_HANDLING"
  | "SOFT_CLOSE"
  | "DIRECT_CLOSE"
  | "UPSELL"
  | "FOLLOWUP_WAIT"
  | "HUMAN_ESCALATION";

export type ObjectionType =
  | "PRICE"
  | "DELIVERY"
  | "TRUST"
  | "COMPETITION"
  | "QUALITY"
  | "NONE";

export interface ProspectAnalysis {
  temperature: LeadTemperature;
  emotion: ProspectEmotion;
  trust: TrustLevel;
  intention: PurchaseIntention;
  activeObjections: ObjectionType[];
  conversationFatigue: number; // 0 to 1
  conversionProbability: number; // 0 to 100
  suggestedStrategy: SalesStrategy;
  reasoning: string;
}

export interface SupervisorInsights {
  analysis: ProspectAnalysis;
  activeStrategy: SalesStrategy;
}
