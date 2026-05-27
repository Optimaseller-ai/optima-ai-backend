import "server-only";

import type { ConversationPipelineDebugger } from "./conversation-pipeline-debugger";
import type { PipelineEngineId, PipelineStepId, SafeEngineResult } from "./pipeline-types";

export type SafeEngineOptions<T> = {
  engine: PipelineEngineId;
  step: PipelineStepId;
  debugger?: ConversationPipelineDebugger;
  inputSnapshot?: Record<string, unknown>;
  fallback?: () => T;
  /** Si true, rethrow après log (étapes critiques uniquement). */
  rethrow?: boolean;
  run: () => T | Promise<T>;
};

/**
 * Exécute un moteur en isolation — dégradation gracieuse si crash.
 */
export async function safeEngineExecute<T>(opts: SafeEngineOptions<T>): Promise<SafeEngineResult<T>> {
  const t0 = Date.now();
  try {
    const result = await opts.run();
    const out: SafeEngineResult<T> = { ok: true, engine: opts.engine, result, ms: Date.now() - t0 };
    opts.debugger?.recordStep({
      step: opts.step,
      engine: opts.engine,
      status: "ok",
      ms: out.ms,
      input: opts.inputSnapshot,
      output: result as unknown,
    });
    return out;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorSource = err instanceof Error ? err.name : "Error";
    console.error("[OPTIMA_PIPELINE_ENGINE_FAIL]", {
      engine: opts.engine,
      step: opts.step,
      errorMessage,
      errorSource,
    });

    const ms = Date.now() - t0;
    let fallbackReason: string | undefined;

    if (opts.fallback) {
      try {
        const result = opts.fallback();
        fallbackReason = "engine_fallback";
        opts.debugger?.recordStep({
          step: opts.step,
          engine: opts.engine,
          status: "degraded",
          ms,
          input: opts.inputSnapshot,
          output: result as unknown,
          fallbackReason,
          errorSource,
          errorMessage,
        });
        return { ok: false, engine: opts.engine, result, fallbackReason, errorSource, errorMessage, ms };
      } catch (fbErr) {
        console.error("[OPTIMA_PIPELINE_FALLBACK_FAIL]", opts.engine, fbErr);
      }
    }

    opts.debugger?.recordStep({
      step: opts.step,
      engine: opts.engine,
      status: "failed",
      ms,
      input: opts.inputSnapshot,
      errorSource,
      errorMessage,
      fallbackReason: "no_fallback",
    });

    if (opts.rethrow) throw err;
    return { ok: false, engine: opts.engine, fallbackReason: "engine_crash", errorSource, errorMessage, ms };
  }
}

/** Version synchrone pour moteurs CPU-only. */
export function safeEngineExecuteSync<T>(opts: Omit<SafeEngineOptions<T>, "run"> & { run: () => T }): SafeEngineResult<T> {
  const t0 = Date.now();
  try {
    const result = opts.run();
    const out: SafeEngineResult<T> = { ok: true, engine: opts.engine, result, ms: Date.now() - t0 };
    opts.debugger?.recordStep({
      step: opts.step,
      engine: opts.engine,
      status: "ok",
      ms: out.ms,
      input: opts.inputSnapshot,
      output: result as unknown,
    });
    return out;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorSource = err instanceof Error ? err.name : "Error";
    const ms = Date.now() - t0;

    if (opts.fallback) {
      const result = opts.fallback();
      opts.debugger?.recordStep({
        step: opts.step,
        engine: opts.engine,
        status: "degraded",
        ms,
        input: opts.inputSnapshot,
        output: result as unknown,
        fallbackReason: "engine_fallback",
        errorSource,
        errorMessage,
      });
      return { ok: false, engine: opts.engine, result, fallbackReason: "engine_fallback", errorSource, errorMessage, ms };
    }

    opts.debugger?.recordStep({
      step: opts.step,
      engine: opts.engine,
      status: "failed",
      ms,
      input: opts.inputSnapshot,
      errorSource,
      errorMessage,
    });

    if (opts.rethrow) throw err;
    return { ok: false, engine: opts.engine, fallbackReason: "engine_crash", errorSource, errorMessage, ms };
  }
}
