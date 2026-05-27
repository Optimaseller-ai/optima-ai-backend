import "server-only";

import type { ConversationResponseMode } from "./conversation-priority-engine";
import { detectResponsePrimaryIntent } from "../coherence/response-intent";

function seedPick(seed: string, rate: number): boolean {
  let h = 2166136261 >>> 0;
  const s = seed || "x";
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return (h % 100) / 100 < rate;
}

/** Humains directs : peu de mots quand la question est simple. */
export function applyMinimalHumanResponse(args: {
  text: string;
  lastUserMessage: string;
  mode: ConversationResponseMode;
  microSeed?: string;
}): string {
  let t = String(args.text ?? "").trim();
  if (!t) return t;

  const intent = detectResponsePrimaryIntent(args.lastUserMessage);
  const userShort = args.lastUserMessage.trim().length < 72;

  if (args.mode === "micro" && userShort) {
    const sentences = t.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    if (sentences.length > 1) {
      t = sentences[0]!;
    }
    if (t.length > 120) {
      t = t.slice(0, 118).trim();
      if (!/[.!?…]$/.test(t)) t += ".";
    }
  }

  if (args.mode === "short" && intent === "location" && t.length > 90) {
    const first = t.split(/(?<=[.!?…])\s+/)[0]?.trim();
    if (first && first.length >= 8) t = first;
  }

  if (args.mode === "defer_soft" && seedPick(args.microSeed ?? t, 0.35)) {
    const sentences = t.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    if (sentences.length > 2) t = sentences.slice(0, 2).join(" ");
  }

  return t.trim();
}
