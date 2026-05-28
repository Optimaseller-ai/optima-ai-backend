import { logStructured } from "@/lib/logging/structured-log";

type MemoryEntry = { value: unknown; expiresAt: number };

const localStore = new Map<string, MemoryEntry>();

export function localFallbackGet<T>(key: string): T | null {
  const row = localStore.get(key);
  if (!row) return null;
  if (row.expiresAt > 0 && Date.now() > row.expiresAt) {
    localStore.delete(key);
    return null;
  }
  return row.value as T;
}

export function localFallbackSet(key: string, value: unknown, ttlSec: number): void {
  localStore.set(key, {
    value,
    expiresAt: ttlSec > 0 ? Date.now() + ttlSec * 1000 : 0,
  });
}

export function localFallbackDel(key: string): void {
  localStore.delete(key);
}

export async function withRedisFallback<T>(args: {
  key: string;
  ttlSec: number;
  operation: "get" | "set" | "del";
  value?: unknown;
  runRedis: () => Promise<T | void>;
  fallbackOnNull?: T | null;
}): Promise<T | null> {
  try {
    const out = await args.runRedis();
    if (args.operation === "get") return (out as T | null) ?? args.fallbackOnNull ?? null;
    return (out as T | null) ?? null;
  } catch (err) {
    logStructured("[REDIS_FALLBACK]", {
      key: args.key,
      operation: args.operation,
      error: err instanceof Error ? err.message : String(err),
    });
    if (args.operation === "get") {
      return localFallbackGet<T>(args.key) ?? args.fallbackOnNull ?? null;
    }
    if (args.operation === "set" && args.value !== undefined) {
      localFallbackSet(args.key, args.value, args.ttlSec);
    }
    if (args.operation === "del") {
      localFallbackDel(args.key);
    }
    return null;
  }
}
