export type PipelineLanguage = "fr" | "en" | "es";

export type EnergyState = "chill" | "focused" | "playful" | "busy" | "premium_seller";

export type TurnKind =
  | "greeting"
  | "simple_ack"
  | "info_clear"
  | "question"
  | "objection"
  | "complaint"
  | "purchase_intent"
  | "unknown";

export type EmotionStageOutput = {
  language: PipelineLanguage;
  emotionLabel: string;
  blocksSocialQuick?: boolean;
  requiresEmpathy?: boolean;
};

export type SalesStrategyOutput = {
  style: "balanced";
  objective: "qualify" | "answer" | "close" | "defuse" | "upsell" | "handoff";
  urgency: "low" | "medium" | "high";
  objectionHandling?: boolean;
};

export type PersonalityOutput = {
  energy: EnergyState;
  voice: "human_whatsapp_fr";
  /**
   * Small “persona levers” consumed by prompt builder / pre-LLM behavior.
   * Keep short: we enforce prompt < 2500 chars.
   */
  constraints: string[];
};

export type QuestionBudget = {
  askQuestion: boolean;
  maxQuestions: 0 | 1;
  roll: number;
  reason: string;
};

export type HumanBehaviorPlan = {
  turnKind: TurnKind;
  questionBudget: QuestionBudget;
  allowShortReactionOnly: boolean;
  allowHesitation: boolean;
  mobileStyle: boolean;
  /**
   * Small pre-LLM style nudges (not post-processing).
   */
  preGenerationDirectives: string[];
};

export type DynamicPromptBundle = {
  systemPrompt: string;
  userPrompt: string;
  includedModules: string[];
  totalChars: number;
};

export type HumanValidatorDecision =
  | { ok: true; reason: string }
  | { ok: false; reason: string; minLen: number; actualLen: number };

export type DeliveryPlan = {
  seenDelayMs: number;
  typingDelayMs: number;
  sendDelayMs: number;
  bucket: "short" | "medium" | "long";
  totalBeforeSendMs: number;
};

export type PipelineLogs = {
  questionProbability?: QuestionBudget;
  blacklistRemoval?: { removed: string[]; count: number };
  memoryCompression?: { factsBefore: number; factsAfter: number; dropped: number };
  humanizationScore?: { validator: HumanValidatorDecision; attempt: number };
  deliverySimulation?: DeliveryPlan;
};

