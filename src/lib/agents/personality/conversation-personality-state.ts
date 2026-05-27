/**
 * État personnalité conversationnelle — continuité fil à fil.
 */

export type PersonalityLevel = "low" | "medium" | "high";

export type EnergyStyle = "calm" | "balanced" | "dynamic";

export type ToneStyle = "elegant" | "warm" | "direct" | "professional" | "conversational";

export type ConversationPace = "slow" | "normal" | "fast";

/** Traits stables de l’agent (catalogue). */
export type AgentStablePersonality = {
  agentId: string;
  displayName: string;
  communicationStyle: string;
  warmthLevel: PersonalityLevel;
  professionalismLevel: PersonalityLevel;
  energyBaseline: PersonalityLevel;
  patienceLevel: PersonalityLevel;
  commercialStyle: "conseiller" | "closer" | "premium";
  empathyLevel: PersonalityLevel;
  formalityLevel: PersonalityLevel;
  salesPressure: PersonalityLevel;
  energyStyle: EnergyStyle;
  toneStyle: ToneStyle;
};

/** État dérivé + mémoire conversation (persistable). */
export type ConversationPersonalityState = {
  agentId: string;
  /** 0–1 stabilité observée ce fil */
  consistencyScore: number;
  /** 0–1 proximité relationnelle */
  proximityLevel: number;
  /** 0–1 confort prospect dans l’échange */
  relationalComfort: number;
  pace: ConversationPace;
  /** Derniers marqueurs ton utilisés (anti répétition) */
  recentToneMarkers: string[];
  /** Énergie effective ce tour (peut moduler légèrement, bornée) */
  effectiveEnergy: PersonalityLevel;
  lastUpdatedAt: number;
};
