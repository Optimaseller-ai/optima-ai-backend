/**
 * Logging Optima — bruit réduit hors debug explicite.
 *
 * - production : warn + error uniquement
 * - development : info + warn + error (pas debug sauf OPTIMA_DEBUG)
 * - OPTIMA_DEBUG=true : tout (debug inclus)
 */

export type OptimaLogLevel = "debug" | "info" | "warn" | "error";

function isDebugMode(): boolean {
  return process.env.OPTIMA_DEBUG === "true" || process.env.OPTIMA_DEBUG === "1";
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function shouldLogOptima(level: OptimaLogLevel): boolean {
  if (level === "error" || level === "warn") return true;
  if (isDebugMode()) return true;
  if (isProduction()) return false;
  return level === "info";
}

function emit(level: OptimaLogLevel, tag: string, payload?: unknown): void {
  if (!shouldLogOptima(level)) return;
  const prefix = `[${tag}]`;
  if (payload === undefined) {
    if (level === "error") console.error(prefix);
    else if (level === "warn") console.warn(prefix);
    else console.log(prefix);
    return;
  }
  if (level === "error") console.error(prefix, payload);
  else if (level === "warn") console.warn(prefix, payload);
  else console.log(prefix, payload);
}

export const optimaLog = {
  debug: (tag: string, payload?: unknown) => emit("debug", tag, payload),
  info: (tag: string, payload?: unknown) => emit("info", tag, payload),
  warn: (tag: string, payload?: unknown) => emit("warn", tag, payload),
  error: (tag: string, payload?: unknown) => emit("error", tag, payload),
};
