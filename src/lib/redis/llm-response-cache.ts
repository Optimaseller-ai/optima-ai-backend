import { createHash } from "crypto";
import { logStructured } from "@/lib/logging/structured-log";
import { redisGet, redisKey, redisSet } from "./redis-client";

type LlmCacheEntry = {
  value: string;
  model?: string;
  createdAt: number;
};

function keyFor(args: {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  message: string;
  contextKey?: string;
}): string {
  const raw = JSON.stringify({
    model: args.model ?? "openai/gpt-4o-mini",
    systemPrompt: args.systemPrompt,
    userPrompt: args.userPrompt,
    message: args.message,
    contextKey: args.contextKey ?? "",
  });
  const hash = createHash("sha256").update(raw).digest("hex");
  return redisKey("llm_cache", hash);
}

function ttlByIntent(intent: "social" | "catalog" | "default"): number {
  if (intent === "social") return 30 * 60;
  if (intent === "catalog") return 6 * 60 * 60;
  return 90 * 60;
}

export async function loadLlmCache(args: {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  message: string;
  contextKey?: string;
}): Promise<string | null> {
  const key = keyFor(args);
  const cached = await redisGet<LlmCacheEntry>(key);
  if (cached?.value) {
    logStructured("[CACHE_HIT]", { key });
    return cached.value;
  }
  logStructured("[CACHE_MISS]", { key });
  return null;
}

export async function saveLlmCache(args: {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  message: string;
  contextKey?: string;
  response: string;
  intent?: "social" | "catalog" | "default";
}): Promise<void> {
  const key = keyFor(args);
  await redisSet(
    key,
    {
      value: args.response,
      model: args.model,
      createdAt: Date.now(),
    } satisfies LlmCacheEntry,
    ttlByIntent(args.intent ?? "default"),
  );
}

