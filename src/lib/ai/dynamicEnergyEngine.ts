import type { EnergyState, PipelineLanguage } from "./pipeline/pipeline-types";

export function inferDynamicEnergy(input: {
  lang: PipelineLanguage;
  message: string;
  turnCount?: number;
  localHour?: number;
  emotionLabel?: string;
  purchaseIntent?: boolean;
}): { energy: EnergyState; reason: string } {
  const msg = String(input.message ?? "");
  const len = msg.trim().length;
  const hour = typeof input.localHour === "number" ? input.localHour : undefined;
  const turnCount = input.turnCount ?? 0;
  const emo = String(input.emotionLabel ?? "").toLowerCase();

  const isNight = hour !== undefined ? hour <= 7 || hour >= 22 : false;
  const isFrustrated = /frustr|anger|irrit|plainte|complaint/.test(emo);
  const isPlayfulSignal = /😂|🤣|😄|😅|mdr|lol\b/i.test(msg);
  const isBusySignal = /\b(attends?|1\s*sec|une\s*seconde|je\s*regarde|je\s*vérifie)\b/i.test(msg);

  if (isFrustrated) return { energy: "focused", reason: "frustration_focus" };
  if (input.purchaseIntent) return { energy: "premium_seller", reason: "purchase_intent_premium" };
  if (isBusySignal) return { energy: "busy", reason: "busy_signal" };
  if (isPlayfulSignal && turnCount >= 2) return { energy: "playful", reason: "playful_signal" };
  if (isNight) return { energy: "chill", reason: "night_chill" };
  if (len < 18) return { energy: "chill", reason: "short_message_chill" };
  return { energy: "focused", reason: "default_focused" };
}

