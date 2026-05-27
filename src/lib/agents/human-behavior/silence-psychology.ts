/**
 * Psychologie du silence — le silence fait partie des vraies conversations (niveau 11).
 * Prompt serveur + heuristiques partagées client.
 */

import { isBareAcknowledgmentMessage } from "@/lib/chat/smart-read-simulation";
import { inferConversationEmotionalTemperature } from "./emotions/conversation-emotion";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export function formatSilencePsychologyPromptBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return [
      "SILENCE PSYCHOLOGY (level 11):",
      "- Real chats sometimes pause — a bare “ok” may need no reply or a very late short ack.",
      "- Do not fill every gap; respect implicit endings.",
    ].join("\n");
  }
  if (lang === "es") {
    return "PSICOLOGÍA DEL SILENCIO: a veces no hace falta responder; respetar finales implícitos.";
  }
  return [
    "PSYCHOLOGIE DU SILENCE (niveau 11) :",
    "- Les vraies conversations ont des blancs — un « ok » froid peut ne pas mériter de réponse ou une réponse très tardive et courte.",
    "- Ne pas combler chaque vide ; respecter les fins implicites.",
  ].join("\n");
}

/** Légèrement plus fin que silence-intelligence niveau 9. */
export function silencePsychologySuppressReply(userMessage: string, seed: string, turnCount = 0): boolean {
  const m = String(userMessage ?? "").trim();
  if (!isBareAcknowledgmentMessage(m)) return false;
  const temp = inferConversationEmotionalTemperature(m);
  if (temp === "frustré" || temp === "irrité") return false;
  const base = seedHash(seed + "silpsy") % 100;
  const boost = turnCount > 12 ? 3 : 0;
  return base < 5 + boost;
}

export function silencePsychologyExtraWaitMs(userMessage: string, seed: string): number {
  if (!isBareAcknowledgmentMessage(userMessage)) return 0;
  if (seedHash(seed + "silpsywait") % 100 >= 8) return 0;
  return 18_000 + Math.round(Math.random() * 16_000);
}
