import { inferConversationEmotionalTemperature } from "@/lib/agents/human-behavior/emotions/conversation-emotion";
import { isBareAcknowledgmentMessage } from "@/lib/chat/smart-read-simulation";
import { detectSocialTension } from "@/lib/agents/human-behavior/social-tension-detector";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/**
 * Délai supplémentaire quand l’émotion / tension sociale est forte (réflexion humaine).
 */
export function microSilenceExtraReactionDelayMs(userMessage: string): number {
  const m = String(userMessage ?? "").trim();
  if (!m) return 0;
  const temp = inferConversationEmotionalTemperature(m);
  const tension = detectSocialTension(m);
  if (temp === "irrité" || temp === "frustré") return 520 + Math.round(Math.random() * 900);
  if (tension !== "none") return 380 + Math.round(Math.random() * 700);
  return 0;
}

/**
 * Parfois ne pas prendre la voie « quick reply » sur un accusé très court — laisser le modèle composer une micro-réponse ou un silence textuel minimal.
 */
export function microSilenceSuppressBareAckQuickReply(userMessage: string, seed: string): boolean {
  if (!isBareAcknowledgmentMessage(userMessage)) return false;
  const h = seedHash(seed + "msil");
  return h % 100 < 7;
}

/**
 * Réduire les enchâssements optionnels quand le tour appelle le calme (ne pas combler artificiellement le vide).
 */
export function microSilenceReduceOptionalInterludes(userMessage: string, seed: string): boolean {
  const m = String(userMessage ?? "").trim();
  if (m.length > 24) return false;
  const temp = inferConversationEmotionalTemperature(m);
  if (temp === "froid" || temp === "irrité") {
    return seedHash(seed + "rd") % 100 < 34;
  }
  return seedHash(seed + "rd2") % 100 < 9;
}
