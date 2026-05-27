/**
 * Mémoire d’apprentissage métier — explicable, versionnée, par business (user_id).
 */

export type ScoredPhrase = {
  phrase: string;
  score: number;
  samples: number;
  lastSeen: string;
  /** Explication courte pour l’admin */
  reason?: string;
};

export type HourPerformance = {
  hour: number;
  label: string;
  conversionRate: number;
  samples: number;
};

export type ProductPerformance = {
  name: string;
  mentions: number;
  conversions: number;
  interestScore: number;
};

export type FollowupPerformance = {
  delayHours: number;
  label: string;
  successRate: number;
  samples: number;
};

export type ObjectionPattern = {
  kind: "price" | "trust" | "delivery" | "quality" | "delay" | "other";
  frequency: number;
  reassuringReplies: ScoredPhrase[];
};

export type StylePerformance = {
  tone: string;
  score: number;
  samples: number;
};

export type LearningInsight = {
  id: string;
  text: string;
  confidence: number;
  sampleSize: number;
  category: "conversion" | "timing" | "product" | "followup" | "style" | "objection";
};

export type LearningMemory = {
  businessId: string;
  updatedAt: string;
  version: number;
  totalObservations: number;
  conversions: number;
  topPerformingClosings: ScoredPhrase[];
  effectiveResponses: ScoredPhrase[];
  bestHours: HourPerformance[];
  bestProducts: ProductPerformance[];
  successfulFollowups: FollowupPerformance[];
  objectionPatterns: ObjectionPattern[];
  stylePerformance: StylePerformance[];
  /** Insights lisibles — générés par sales-insight-generator */
  insights: LearningInsight[];
};

export const EMPTY_LEARNING_MEMORY = (businessId: string): LearningMemory => ({
  businessId,
  updatedAt: new Date().toISOString(),
  version: 1,
  totalObservations: 0,
  conversions: 0,
  topPerformingClosings: [],
  effectiveResponses: [],
  bestHours: [],
  bestProducts: [],
  successfulFollowups: [],
  objectionPatterns: [],
  stylePerformance: [],
  insights: [],
});
