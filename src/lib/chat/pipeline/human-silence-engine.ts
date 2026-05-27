export type WeakUserSignal = {
  weak: boolean;
  kind:
    | "ack"
    | "cold"
    | "emoji_only"
    | "hmm"
    | "short"
    | "unknown";
  reason: string;
};

function norm(s: string) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectWeakUserMessage(message: string): WeakUserSignal {
  const m = String(message ?? "").trim();
  const n = norm(m);
  if (!n) return { weak: true, kind: "short", reason: "empty" };
  if (/^[\p{Extended_Pictographic}\uFE0F\s]+$/u.test(m)) return { weak: true, kind: "emoji_only", reason: "emoji_only" };
  if (/^(ok|okay|daccord|d'accord|dac|ah d'accord|je vois|bon|oui|non|ça marche|ca marche)$/i.test(n))
    return { weak: true, kind: "ack", reason: "ack_phrase" };
  if (/^(hmm+|hum+|hm+)$/i.test(n)) return { weak: true, kind: "hmm", reason: "hmm" };
  if (n.length <= 6) return { weak: true, kind: "short", reason: "very_short" };
  return { weak: false, kind: "unknown", reason: "not_weak" };
}

export function pickMinimalHumanReply(args: {
  userMessage: string;
  allowEmoji: boolean;
  seed?: string;
}): { reply: string; noFollowUp: true; reason: string } {
  const n = norm(args.userMessage);
  const allowEmoji = args.allowEmoji;

  const pool = (() => {
    if (/😂|🤣/.test(args.userMessage)) return ["😂", "mdr 😄", "😄"] as const;
    if (n === "ok" || n === "okay") return ["ça marche", "ok", allowEmoji ? "ok 😄" : "ok"] as const;
    if (n === "oui") return [allowEmoji ? "oui 😄" : "oui", "ok", "exact"] as const;
    if (n === "non") return ["non", "ok"] as const;
    if (n.includes("ah d'accord") || n === "d'accord" || n === "dac") return ["d'accord", "ok", "ça marche"] as const;
    if (n.includes("je vois")) return ["je vois", "ok", "ça marche"] as const;
    if (/^(hmm+|hum+|hm+)$/.test(n)) return ["hmm", "ok", "je vois"] as const;
    return ["ça marche", "ok", "d'accord", "je vois"] as const;
  })();

  const seed = String(args.seed ?? n);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const reply = pool[h % pool.length]!;
  return { reply, noFollowUp: true, reason: "minimal_reply_pool" };
}

export function updateAiPressureScore(input: {
  previous?: number;
  replyText: string;
  questionCount: number;
  emojiCount: number;
}): number {
  const prev = Number.isFinite(input.previous) ? Number(input.previous) : 0;
  let score = Math.max(0, Math.min(1, prev));
  if (input.replyText.length > 220) score += 0.12;
  if (input.replyText.length > 420) score += 0.18;
  if (input.questionCount >= 1) score += 0.12;
  if (input.questionCount >= 2) score += 0.2;
  if (input.emojiCount >= 2) score += 0.12;
  // natural decay
  score *= 0.92;
  return Math.max(0, Math.min(1, score));
}

