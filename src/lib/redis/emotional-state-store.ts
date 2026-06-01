import type { EmotionalContinuitySnapshot } from "@/lib/chat/emotion/emotional-continuity-engine";
import { logStructured } from "@/lib/logging/structured-log";
import { redisGet, redisSet } from "./redis-client";

const TTL_SEC = 7 * 24 * 60 * 60;

function key(sessionId: string): string {
  return `emotion_state:${String(sessionId ?? "").trim()}`;
}

export async function loadEmotionalState(sessionId: string): Promise<EmotionalContinuitySnapshot | null> {
  return (await redisGet<EmotionalContinuitySnapshot>(key(sessionId))) ?? null;
}

export async function saveEmotionalState(sessionId: string, snapshot: EmotionalContinuitySnapshot): Promise<void> {
  await redisSet(key(sessionId), snapshot, TTL_SEC);
  logStructured("[EMOTIONAL_STATE_SAVED]", {
    session_id: sessionId,
    active: snapshot.active.label,
    score: snapshot.active.score,
    trust: snapshot.relationship.trustScore,
    warmth: snapshot.relationship.warmthScore,
    frustration: snapshot.relationship.frustrationScore,
  });
}

