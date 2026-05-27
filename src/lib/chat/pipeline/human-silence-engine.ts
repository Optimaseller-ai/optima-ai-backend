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

export type ConversationEndingSignal = {
  ending: boolean;
  kind: "thanks" | "see_you" | "i_will_check" | "ok_thanks" | "goodbye" | "unknown";
  reason: string;
};

export function detectConversationEnding(message: string): ConversationEndingSignal {
  const m = String(message ?? "").trim();
  const n = norm(m);
  if (!n) return { ending: false, kind: "unknown", reason: "empty" };

  // Common “end the turn / end the convo” signals (FR-first).
  if (/^(ok|okay)\s*(merci|thanks)\b/i.test(n) || /^merci\b/i.test(n) || /^thx\b/i.test(n) || /^thanks\b/i.test(n)) {
    return { ending: true, kind: /^(ok|okay)\s*(merci|thanks)\b/i.test(n) ? "ok_thanks" : "thanks", reason: "thanks" };
  }
  if (/\b(je vais voir|je verrai|je regarde|je vais regarder|on verra)\b/i.test(n)) {
    return { ending: true, kind: "i_will_check", reason: "will_check" };
  }
  if (/\b(je passe demain|a demain|à demain|demain je passe|je passe demain)\b/i.test(n)) {
    return { ending: true, kind: "see_you", reason: "see_you_tomorrow" };
  }
  if (/^(bonne\s*(soir(ée)?|journée)|bonne nuit|a\+|à\+|bye|ciao)\b/i.test(n)) {
    return { ending: true, kind: "goodbye", reason: "goodbye" };
  }

  return { ending: false, kind: "unknown", reason: "not_ending" };
}

export function pickEndingHumanReply(args: {
  userMessage: string;
  lang?: "fr" | "en" | "es";
  seed?: string;
}): { reply: string; noFollowUp: true; reason: string } {
  const n = norm(args.userMessage);
  const lang = args.lang ?? "fr";

  const pool = (() => {
    // Prefer no emojis; keep it short and final.
    if (/^(ok|okay)\s*(merci|thanks)\b/i.test(n)) {
      return lang === "en"
        ? (["sure", "no problem", "ok"] as const)
        : lang === "es"
          ? (["vale", "de acuerdo", "con gusto"] as const)
          : (["avec plaisir", "ça marche", "d'accord"] as const);
    }
    if (/^merci\b/i.test(n) || /^thx\b/i.test(n) || /^thanks\b/i.test(n)) {
      return lang === "en"
        ? (["no problem", "sure", "with pleasure"] as const)
        : lang === "es"
          ? (["con gusto", "de nada", "vale"] as const)
          : (["avec plaisir", "pas de souci", "ça marche"] as const);
    }
    if (/\b(je passe demain|a demain|à demain|demain je passe|je passe demain)\b/i.test(n)) {
      return lang === "en"
        ? (["see you tomorrow", "ok, tomorrow then"] as const)
        : lang === "es"
          ? (["vale, mañana", "hasta mañana"] as const)
          : (["à demain", "ok à demain", "ça marche, à demain"] as const);
    }
    if (/\b(je vais voir|je verrai|je regarde|je vais regarder|on verra)\b/i.test(n)) {
      return lang === "en"
        ? (["ok", "sure"] as const)
        : lang === "es"
          ? (["vale", "ok"] as const)
          : (["ça marche", "d'accord", "ok"] as const);
    }
    if (/^(bonne\s*(soir(ée)?|journée)|bonne nuit|a\+|à\+|bye|ciao)\b/i.test(n)) {
      return lang === "en"
        ? (["have a good one", "good evening"] as const)
        : lang === "es"
          ? (["buena noche", "que tengas buena noche"] as const)
          : (["bonne soirée", "bonne nuit", "à plus"] as const);
    }
    return lang === "en"
      ? (["ok", "sure"] as const)
      : lang === "es"
        ? (["vale", "ok"] as const)
        : (["ça marche", "d'accord", "ok"] as const);
  })();

  const seed = String(args.seed ?? n);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const reply = pool[h % pool.length]!;
  return { reply, noFollowUp: true, reason: "conversation_ending" };
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
  // Premium policy: minimal replies should not add emojis by default.
  const allowEmoji = false;

  const pool = (() => {
    if (/😂|🤣/.test(args.userMessage)) return ["😂", "mdr", "😄"] as const;
    if (n === "ok" || n === "okay") return ["ça marche", "ok"] as const;
    if (n === "oui") return ["oui", "ok", "exact"] as const;
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

