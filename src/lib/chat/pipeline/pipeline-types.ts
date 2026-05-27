/**
 * Types — pipeline conversationnel Optima Seller AI.
 */

export type PipelineLang = "fr" | "en" | "es";

export type PipelineStepId =
  | "social"
  | "emotion"
  | "memory"
  | "personality"
  | "business"
  | "intent"
  | "strategy"
  | "response"
  | "humanization"
  | "automation"
  | "persist"
  | "audio";

export type PipelineEngineId =
  | "social_humanization"
  | "social_priority_router"
  | "emotional_intelligence"
  | "personality_consistency"
  | "conversation_memory"
  | "sales_signals"
  | "live_orchestrator"
  | "sales_opportunity"
  | "sales_decision"
  | "openrouter"
  | "rag"
  | "post_process"
  | "sanitize_hold"
  | "automation"
  | "merge_user_turn"
  | "merge_assistant_turn";

export type PipelineStepStatus = "ok" | "degraded" | "skipped" | "failed";

export type PipelineStepTrace = {
  step: PipelineStepId;
  engine: PipelineEngineId;
  status: PipelineStepStatus;
  ms: number;
  inputSnapshot?: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  fallbackReason?: string;
  errorSource?: string;
  errorMessage?: string;
};

export type PipelineFallbackKind =
  | "social"
  | "empathetic"
  | "neutral"
  | "discovery"
  | "takeover"
  | "generate_failed"
  | "internal_error"
  | "none";

export type ReplyTransformLogSnapshot = {
  step: string;
  beforeLen: number;
  afterLen: number;
  reason: string;
  delta: number;
};

export type ConversationPipelineRuntimeSnapshot = {
  traceId: string;
  completedAt: string;
  totalMs: number;
  responseMode:
    | "instant_social"
    | "quick_human"
    | "llm"
    | "fallback"
    | "priority_critical"
    | "priority_business_data";
  activeEngines: PipelineEngineId[];
  detectedEmotion?: string;
  socialSignal?: string;
  selectedStrategy?: string;
  fallbackKind: PipelineFallbackKind;
  fallbackReason?: string;
  automationTriggered?: boolean;
  socialOnlyMode?: boolean;
  automationBlockReason?: string;
  leadClassificationReason?: string;
  replyTransformationChain?: ReplyTransformLogSnapshot[];
  steps: PipelineStepTrace[];
  /** Échec fatal d’une étape — seul ce flag doit piloter success:false côté client. */
  hadErrors: boolean;
  hadDegradations?: boolean;
};

export type SafeEngineResult<T> = {
  ok: boolean;
  engine: PipelineEngineId;
  result?: T;
  fallbackReason?: string;
  errorSource?: string;
  errorMessage?: string;
  ms: number;
};
