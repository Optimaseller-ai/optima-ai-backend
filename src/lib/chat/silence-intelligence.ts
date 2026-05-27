import { isBareAcknowledgmentMessage } from "@/lib/chat/smart-read-simulation";
import { inferConversationEmotionalTemperature } from "@/lib/agents/human-behavior/emotions/conversation-emotion";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/**
 * Niveau 9 : parfois la meilleure réponse est aucune réponse (quick reply court-circuité côté serveur).
 * Le client peut aussi prolonger le silence avant frappe.
 */
export function silenceIntelligenceSuppressReply(userMessage: string, seed: string): boolean {
  const m = String(userMessage ?? "").trim();
  if (!isBareAcknowledgmentMessage(m)) return false;
  const temp = inferConversationEmotionalTemperature(m);
  if (temp !== "froid" && temp !== "neutre") return false;
  return seedHash(seed + "silint") % 100 < 4;
}

export function silenceIntelligenceExtraWaitMs(userMessage: string, seed: string): number {
  if (!isBareAcknowledgmentMessage(userMessage)) return 0;
  if (seedHash(seed + "silwait") % 100 >= 6) return 0;
  return 22_000 + Math.round(Math.random() * 18_000);
}
