import { loadEnv } from "@/config/env";
import { logStructured } from "@/lib/logging/structured-log";
import { getRedis, redisKey } from "./redis-client";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("UPSTASH_TIMEOUT")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function validateRedisEnvOnBoot(): Promise<void> {
  const env = loadEnv();
  const urlOk = Boolean(env.UPSTASH_REDIS_REST_URL);
  const tokenOk = Boolean(env.UPSTASH_REDIS_REST_TOKEN);
  if (!urlOk || !tokenOk) {
    logStructured("[REDIS_CONFIG_ERROR]", {
      UPSTASH_REDIS_REST_URL: urlOk ? "present" : "missing",
      UPSTASH_REDIS_REST_TOKEN: tokenOk ? "present" : "missing",
      fallback: "local_memory",
    });
    return;
  }

  const r = getRedis();
  if (!r) {
    logStructured("[REDIS_CONFIG_ERROR]", { reason: "getRedis_null", fallback: "local_memory" });
    return;
  }

  try {
    // Upstash REST doesn't “connect”, so we do a tiny roundtrip.
    const probeKey = redisKey("boot_probe");
    await withTimeout(r.set(probeKey, Date.now(), { ex: 60 }), 1500);
    await withTimeout(r.get(probeKey), 1500);
    logStructured("[REDIS_READY]", { provider: "upstash" });
    logStructured("[UPSTASH_CONNECTED]", { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UPSTASH_TIMEOUT")) {
      logStructured("[UPSTASH_TIMEOUT]", { at: "boot_probe" });
    }
    logStructured("[REDIS_CONFIG_ERROR]", { reason: msg, fallback: "local_memory" });
  }
}

