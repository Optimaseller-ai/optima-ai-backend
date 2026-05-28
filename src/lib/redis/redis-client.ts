import { Redis } from "@upstash/redis";
import { loadEnv } from "@/config/env";
import { logStructured } from "@/lib/logging/structured-log";
import { localFallbackDel, localFallbackGet, localFallbackSet, withRedisFallback } from "./redis-fallback-manager";

let redis: Redis | null | undefined;
let warnedMissing = false;

function resolveRedisCredentials(): { url: string; token: string } | null {
  const env = loadEnv();
  const url = env.REDIS_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.REDIS_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

/** Singleton Upstash Redis — null if not configured. */
export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const creds = resolveRedisCredentials();
  if (!creds) {
    redis = null;
    if (!warnedMissing) {
      warnedMissing = true;
      logStructured("[REDIS_FALLBACK]", { reason: "redis_not_configured", mode: "local_memory" });
    }
    return null;
  }
  redis = new Redis({ url: creds.url, token: creds.token });
  return redis;
}

export function redisKey(...parts: string[]): string {
  return ["optima", ...parts].join(":");
}

export function sessionRedisKey(sessionId: string): string {
  return `session:${String(sessionId ?? "").trim()}`;
}

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 120 * (i + 1)));
    }
  }
  throw last;
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return localFallbackGet<T>(key);
  return withRedisFallback<T>({
    key,
    ttlSec: 0,
    operation: "get",
    runRedis: async () => retry(() => r.get<T>(key)),
    fallbackOnNull: localFallbackGet<T>(key),
  });
}

export async function redisSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  const r = getRedis();
  if (!r) {
    localFallbackSet(key, value, ttlSec);
    return;
  }
  await withRedisFallback({
    key,
    ttlSec,
    operation: "set",
    value,
    runRedis: async () => {
      await retry(() => r.set(key, value, { ex: ttlSec }));
    },
  });
}

export async function redisDel(key: string): Promise<void> {
  const r = getRedis();
  if (!r) {
    localFallbackDel(key);
    return;
  }
  await withRedisFallback({
    key,
    ttlSec: 0,
    operation: "del",
    runRedis: async () => {
      await retry(() => r.del(key));
    },
  });
}
