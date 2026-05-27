import "server-only";

import type {
  ConversationPipelineRuntimeSnapshot,
  PipelineEngineId,
  PipelineFallbackKind,
  PipelineStepId,
  PipelineStepStatus,
  PipelineStepTrace,
} from "./pipeline-types";

const MAX_SNAPSHOT_CHARS = 400;

function trimSnapshot(value: unknown): Record<string, unknown> | undefined {
  if (value == null) return undefined;
  try {
    const raw = JSON.stringify(value);
    if (raw.length <= MAX_SNAPSHOT_CHARS) {
      return JSON.parse(raw) as Record<string, unknown>;
    }
    return { _truncated: true, preview: raw.slice(0, MAX_SNAPSHOT_CHARS) };
  } catch {
    return { _unserializable: true, type: typeof value };
  }
}

/** Trace structurée d’un tour conversationnel serveur. */
export class ConversationPipelineDebugger {
  readonly traceId: string;
  private readonly startedAt = Date.now();
  private readonly steps: PipelineStepTrace[] = [];
  private activeEngines = new Set<PipelineEngineId>();
  private responseMode: ConversationPipelineRuntimeSnapshot["responseMode"] = "llm";
  private fallbackKind: PipelineFallbackKind = "none";
  private fallbackReason?: string;
  private detectedEmotion?: string;
  private socialSignal?: string;
  private selectedStrategy?: string;
  private automationTriggered = false;
  private hadErrors = false;
  private hadDegradations = false;

  constructor(traceId?: string) {
    this.traceId = traceId ?? `pipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  setMeta(
    partial: {
      responseMode?: ConversationPipelineRuntimeSnapshot["responseMode"];
      fallbackKind?: PipelineFallbackKind;
      fallbackReason?: string;
      detectedEmotion?: string;
      socialSignal?: string;
      selectedStrategy?: string;
      automationTriggered?: boolean;
    } & Record<string, unknown>,
  ) {
    if (partial.responseMode) this.responseMode = partial.responseMode;
    if (partial.fallbackKind) this.fallbackKind = partial.fallbackKind;
    if (partial.fallbackReason) this.fallbackReason = partial.fallbackReason;
    if (partial.detectedEmotion) this.detectedEmotion = partial.detectedEmotion;
    if (partial.socialSignal) this.socialSignal = partial.socialSignal;
    if (partial.selectedStrategy) this.selectedStrategy = partial.selectedStrategy;
    if (partial.automationTriggered != null) this.automationTriggered = partial.automationTriggered;
  }

  recordStep(args: {
    step: PipelineStepId;
    engine: PipelineEngineId;
    status: PipelineStepStatus;
    ms: number;
    input?: unknown;
    output?: unknown;
    fallbackReason?: string;
    errorSource?: string;
    errorMessage?: string;
  }) {
    this.activeEngines.add(args.engine);
    if (args.status === "failed") this.hadErrors = true;
    if (args.status === "degraded") this.hadDegradations = true;

    const trace: PipelineStepTrace = {
      step: args.step,
      engine: args.engine,
      status: args.status,
      ms: args.ms,
      inputSnapshot: trimSnapshot(args.input),
      outputSnapshot: trimSnapshot(args.output),
      fallbackReason: args.fallbackReason,
      errorSource: args.errorSource,
      errorMessage: args.errorMessage?.slice(0, 240),
    };

    this.steps.push(trace);

    console.log("[OPTIMA_PIPELINE]", {
      traceId: this.traceId,
      step: args.step,
      engine: args.engine,
      status: args.status,
      ms: args.ms,
      fallbackReason: args.fallbackReason,
      errorSource: args.errorSource,
    });
  }

  toSnapshot(): ConversationPipelineRuntimeSnapshot {
    return {
      traceId: this.traceId,
      completedAt: new Date().toISOString(),
      totalMs: Date.now() - this.startedAt,
      responseMode: this.responseMode,
      activeEngines: [...this.activeEngines],
      detectedEmotion: this.detectedEmotion,
      socialSignal: this.socialSignal,
      selectedStrategy: this.selectedStrategy,
      fallbackKind: this.fallbackKind,
      fallbackReason: this.fallbackReason,
      automationTriggered: this.automationTriggered,
      steps: this.steps,
      hadErrors: this.hadErrors,
      hadDegradations: this.hadDegradations,
    };
  }
}
