/**
 * Intelligence émotionnelle — états et contrats superviseur.
 */

export type DominantEmotion =
  | "frustration"
  | "excitement"
  | "impatience"
  | "confidence"
  | "hesitation"
  | "confusion"
  | "mild_anger"
  | "enthusiasm"
  | "purchase_stress"
  | "scam_fear"
  | "emotional_urgency"
  | "satisfaction"
  | "neutral";

export type EmotionalTrustBand = "low" | "medium" | "high";

export type ProspectEmotionalState = {
  dominantEmotion: DominantEmotion;
  /** 0–1 */
  trustLevel: number;
  /** 0–1 confiance pour passer commande */
  buyingConfidence: number;
  /** 0–1 */
  frustrationLevel: number;
  /** 0–1 confort dans l’échange */
  conversationComfort: number;
  /** 0–1 patience estimée */
  patienceLevel: number;
  /** -1 baisse, 0 stable, +1 montée émotionnelle positive */
  emotionalMomentum: -1 | 0 | 1;
  /** Signaux secondaires actifs */
  activeSignals: DominantEmotion[];
  lastUpdatedAt: number;
};

export type EmotionalIntelligenceInput = {
  message: string;
  previousState?: ProspectEmotionalState;
  salesSignalsTrust01?: number;
  turnCount?: number;
  commercialObjections?: string[];
  lang?: "fr" | "en" | "es";
};

export type SalesEmotionalAdaptation = {
  blockAggressiveClose: boolean;
  accelerateConversion: boolean;
  increaseReassurance: boolean;
  slowDownPace: boolean;
  reasoning: string;
};

export type EmotionalSupervisorInsights = {
  dominantEmotion: DominantEmotion;
  trustBand: EmotionalTrustBand;
  trustLevel01: number;
  abandonmentRisk: "low" | "medium" | "high";
  relationalQuality: "fragile" | "developing" | "solid";
  conversationEmotionalState: string;
  buyingConfidence01: number;
  frustrationLevel01: number;
};

export type EmotionalIntelligenceOutput = {
  state: ProspectEmotionalState;
  adaptation: SalesEmotionalAdaptation;
  supervisor: EmotionalSupervisorInsights;
  empatheticGuidanceFr: string[];
  empatheticGuidanceEn: string[];
  antiRoboticRules: string[];
};
