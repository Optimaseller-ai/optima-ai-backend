import type { ProspectTurnIntent } from "@/lib/agents/human-behavior/response-orchestrator";
import type { ProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";

export type SmartSilenceDecision = {
  shouldPause: boolean;
  pauseMs: number;
  reason: string;
};

const ANGRY_RE = /\b(connard|merde|putain|arnaque|scam|honte|inadmissible)\b/i;

export function evaluateSmartSilence(args: {
  message: string;
  emotion: ProspectEmotion;
  intent: ProspectTurnIntent;
}): SmartSilenceDecision {
  const msg = args.message.trim();
  if (!msg) {
    return { shouldPause: false, pauseMs: 0, reason: "" };
  }

  if (args.emotion === "anger" || ANGRY_RE.test(msg)) {
    return {
      shouldPause: true,
      pauseMs: 2500,
      reason: "Message agressif — courte pause humaine avant de répondre (ne pas réagir instantanément).",
    };
  }

  if (args.emotion === "frustration" && msg.length > 120) {
    return {
      shouldPause: true,
      pauseMs: 1800,
      reason: "Frustration longue — laisser respirer avant réponse.",
    };
  }

  if (args.intent === "plainte") {
    return {
      shouldPause: true,
      pauseMs: 1500,
      reason: "Plainte — pause d'écoute avant réponse.",
    };
  }

  return { shouldPause: false, pauseMs: 0, reason: "" };
}
