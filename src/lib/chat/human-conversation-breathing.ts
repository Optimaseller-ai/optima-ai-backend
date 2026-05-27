import { isBareAcknowledgmentMessage } from "@/lib/chat/smart-read-simulation";

/**
 * « Respiration » : attente UX prolongée avant de montrer l’activité (surtout sur accusé très court).
 * N’annule pas la réponse — augmente seulement l’attente avant la phase « écriture ».
 */
export function humanConversationBreathingExtraMs(userMessage: string): number {
  const m = String(userMessage ?? "").trim();
  if (m.length > 8) return 0;
  if (!isBareAcknowledgmentMessage(m)) return 0;
  if (Math.random() > 0.11) return 0;
  return 16_000 + Math.round(Math.random() * 24_000);
}
