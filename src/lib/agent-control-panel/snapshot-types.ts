/**
 * Contrats d’affichage pour le panneau supervision — aucune logique métier.
 * À terme ce snapshot est sérialisé par l’API.
 */

export type ProspectInterestDisplay = "cold" | "warm" | "hot" | "ready";

export type AgentLiveStatus = "active" | "processing" | "waiting_approval" | "executing_action";

export type TimelineEntryKind = "message" | "intent" | "action" | "email_sent" | "followup_scheduled";

export type TimelineEntry = {
  id: string;
  at: string;
  kind: TimelineEntryKind;
  label: string;
  detail?: string;
};

export type SalesInsightSnapshot = {
  strategy: string;
  objection: string;
  decisionReason: string;
  urgencyLevel: string;
  nextRecommendation: string;
  /** Intelligence émotionnelle (optionnel). */
  dominantEmotion?: string;
  trustLevel?: string;
  abandonmentRisk?: string;
  relationalQuality?: string;
  emotionalState?: string;
  activePersonality?: string;
  personalityConsistency?: string;
  humanizationQuality?: string;
  emotionalStability?: string;
};

export type ProspectProfileSnapshot = {
  id: string;
  sessionId?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  country?: string | null;
  preferredLanguage?: string | null;
  tags?: string[];
  /** 0–100 — fourni par le backend. */
  salesScore: number;
  status: ProspectInterestDisplay;
  intents: string[];
  products: string[];
  historySummary: string;
  lastActivityAt: string;
  nextAction: string;
};

export type AgentControlSnapshot = {
  updatedAt: string;
  prospect: ProspectProfileSnapshot;
  salesInsight: SalesInsightSnapshot;
  timeline: TimelineEntry[];
  agent: {
    status: AgentLiveStatus;
    label: string;
  };
};
