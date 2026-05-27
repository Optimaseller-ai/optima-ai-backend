import type { DeliveryPlan } from "@/lib/ai/pipeline/pipeline-types";

function randInt(min: number, max: number) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(a + Math.random() * (b - a + 1));
}

export function buildHumanDeliveryPlan(input: { replyText: string }): DeliveryPlan {
  const len = String(input.replyText ?? "").trim().length;
  const bucket: DeliveryPlan["bucket"] = len <= 40 ? "short" : len <= 120 ? "medium" : "long";

  const seenDelayMs = randInt(4000, 8000);
  const typingDelayMs = randInt(3000, 6000);

  const sendDelayMs =
    bucket === "short" ? randInt(3000, 5000) : bucket === "medium" ? randInt(6000, 9000) : randInt(10_000, 15_000);

  return {
    seenDelayMs,
    typingDelayMs,
    sendDelayMs,
    bucket,
    totalBeforeSendMs: seenDelayMs + typingDelayMs + sendDelayMs,
  };
}

