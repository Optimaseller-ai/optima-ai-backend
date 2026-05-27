/**
 * Contrats du cerveau commercial agents — alignés sur SupervisorInsights LLM.
 */

export type {
  LeadTemperature,
  ObjectionType,
  ProspectAnalysis,
  ProspectEmotion,
  PurchaseIntention,
  SalesStrategy,
  SupervisorInsights,
  TrustLevel,
} from "@/lib/ai/sales/types";

import type { ProspectAnalysis, SalesStrategy, SupervisorInsights } from "@/lib/ai/sales/types";
import type {
  ConversationProfile,
  SalesSignalsMemory,
  SellerIntent,
} from "@/lib/agents/memory/conversation-state";

export type SalesDecisionInput = {
  message: string;
  sellerIntent?: SellerIntent;
  conversationProfile?: ConversationProfile;
  commercialMemory?: { objections?: string[]; budgetNotes?: string };
  salesSignalsMemory?: SalesSignalsMemory;
  stats?: { turn_count?: number; fatigue?: number; last_active_at?: number };
  /** Millisecondes depuis le dernier message prospect (optionnel). */
  silenceMs?: number;
  lang?: "fr" | "en" | "es";
  /** Nombre de relances commerciales récentes (anti-spam). */
  recentSalesPushCount?: number;
  /** Intelligence émotionnelle — bloque close agressif si frustration / méfiance. */
  blockAggressiveClose?: boolean;
};

export type ClosingLevel = "soft" | "medium" | "direct";

export type SalesDecisionGuards = {
  blockHardClose: boolean;
  blockUpsell: boolean;
  softenTone: boolean;
  reasons: string[];
};

export type ObjectionResponseHint = {
  type: import("@/lib/ai/sales/types").ObjectionType;
  guidanceFr: string[];
  guidanceEn: string[];
  exampleLineFr?: string;
};

export type UpsellRecommendation = {
  kind: "accessory" | "alternative" | "similar" | "tier_step_up";
  promptLineFr: string;
  promptLineEn: string;
  natural: boolean;
};

export type SalesDecisionOutput = {
  insights: SupervisorInsights;
  analysis: ProspectAnalysis;
  activeStrategy: SalesStrategy;
  strategyInstruction: string;
  closingLevel: ClosingLevel;
  closingLinesFr: string[];
  closingLinesEn: string[];
  objectionHints: ObjectionResponseHint[];
  upsell?: UpsellRecommendation;
  followupHint?: string;
  guards: SalesDecisionGuards;
  /** Bloc court pour injection prompt (sans logique UI). */
  promptSummaryFr: string;
};
