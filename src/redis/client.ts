import { Redis } from "@upstash/redis";
import { loadEnv } from "../config/env.js";

let redis: Redis | null | undefined;

/** Client Upstash Redis — null si non configuré (dev local sans Redis). */
export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;

  const env = loadEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    redis = null;
    console.warn("[OPTIMA_AI_BACKEND] Redis not configured — in-memory fallbacks active");
    return null;
  }

  redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redis;
}

export function redisKey(...parts: string[]): string {
  return ["optima", ...parts].join(":");
}
