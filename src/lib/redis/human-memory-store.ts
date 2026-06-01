import type { HumanMemoryState } from "@/lib/chat/memory/human-memory-engine";
import { logStructured } from "@/lib/logging/structured-log";
import { redisGet, redisSet } from "./redis-client";

const HUMAN_MEMORY_TTL_SEC = 7 * 24 * 60 * 60;

function humanMemoryKey(sessionId: string): string {
  return `human_memory:${String(sessionId ?? "").trim()}`;
}

export async function loadHumanMemory(sessionId: string): Promise<HumanMemoryState | null> {
  const key = humanMemoryKey(sessionId);
  const out = await redisGet<HumanMemoryState>(key);
  return out ?? null;
}

export async function saveHumanMemory(sessionId: string, state: HumanMemoryState): Promise<void> {
  const key = humanMemoryKey(sessionId);
  await redisSet(key, state, HUMAN_MEMORY_TTL_SEC);
  logStructured("[HUMAN_MEMORY_UPDATED]", {
    key,
    memories: state.memories.length,
    mood: state.emotionalState.mood,
    frustration: state.emotionalState.frustration01,
  });
}

