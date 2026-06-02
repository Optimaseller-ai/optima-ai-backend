export type FragmentType = "reaction" | "validation" | "main" | "followup";

export type FragmentedReply = {
  fragments: {
    content: string;
    delayMs: number;
    typingDurationMs: number;
    fragmentType: FragmentType;
  }[];
  totalDurationMs: number;
  fragmented: boolean;
};

export type FragmentationPersonalityHints = {
  fragmentationStyle?: "rare" | "normal" | "often";
  emojiFrequency?: number;
  averageSentenceLength?: number;
  reactionDelayStyle?: "fast" | "normal" | "slow";
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

function random01(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pickCount(seed: string): 1 | 2 | 3 {
  const r = random01(hashSeed(seed));
  if (r < 0.6) return 1;
  if (r < 0.9) return 2;
  return 3;
}

const CRITICAL_RE =
  /\b(otp|code|paiement|payment|transaction|prix\s*:\s*\d|fcfa|xaf|iban|swift|compte|token|confirmation)\b/i;

function hasCriticalInfo(text: string): boolean {
  return CRITICAL_RE.test(String(text ?? ""));
}

export function shouldFragmentReply(args: {
  reply: string;
  userMessage: string;
  emotion?: string;
  socialOnlyMode?: boolean;
  personality?: FragmentationPersonalityHints;
}): boolean {
  const reply = String(args.reply ?? "").trim();
  if (!reply || reply.length < 18) return false;
  if (hasCriticalInfo(reply)) return false;
  if (reply.split(/\s+/).length < 7) return false;
  const e = String(args.emotion ?? "").toLowerCase();
  if (e === "cold") return false;
  const style = args.personality?.fragmentationStyle ?? "normal";
  if (style === "rare") return reply.length > 140;
  if (style === "often") {
    // Allow fragmentation more often for WhatsApp-y agents.
    if (reply.length >= 60) return true;
  }
  if (args.socialOnlyMode) return true;
  return /\b(oui|franchement|je vois|attends|je regarde|dommage|bizarre)\b/i.test(reply) || reply.length > 90;
}

export function injectNaturalMicroPauses(args: { baseMs: number; seed: string; emotion?: string }): number {
  const r = random01(hashSeed(args.seed + "|pause"));
  let ms = args.baseMs + Math.round(r * 700);
  const e = String(args.emotion ?? "").toLowerCase();
  if (e === "frustrated" || e === "angry") ms += 500;
  if (e === "playful" || e === "warm") ms -= 220;
  return clamp(ms, 600, 5200);
}

export function computeFragmentTiming(args: {
  fragment: string;
  fragmentType: FragmentType;
  seed: string;
  emotion?: string;
}): { delayMs: number; typingDurationMs: number } {
  const len = String(args.fragment ?? "").trim().length;
  const baseDelay =
    args.fragmentType === "reaction" ? 800 : args.fragmentType === "validation" ? 1200 : args.fragmentType === "followup" ? 1700 : 2200;
  const delayMs = injectNaturalMicroPauses({ baseMs: baseDelay + Math.floor(len * 18), seed: args.seed, emotion: args.emotion });
  const typingDurationMs = clamp(Math.round(350 + len * 46), 400, 6500);
  return { delayMs, typingDurationMs };
}

export function simulateTypingBursts(args: {
  fragments: { content: string; fragmentType: FragmentType }[];
  seed: string;
  emotion?: string;
}): FragmentedReply["fragments"] {
  return args.fragments.map((f, i) => {
    const t = computeFragmentTiming({
      fragment: f.content,
      fragmentType: f.fragmentType,
      seed: `${args.seed}|${i}|${f.content}`,
      emotion: args.emotion,
    });
    console.log("[FRAGMENT_TIMING]", { index: i, type: f.fragmentType, ...t });
    return {
      content: f.content,
      delayMs: t.delayMs,
      typingDurationMs: t.typingDurationMs,
      fragmentType: f.fragmentType,
    };
  });
}

function splitNaturally(reply: string, count: 2 | 3): string[] {
  const s = String(reply ?? "").trim();
  const sentences = s.split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean);
  if (sentences.length >= count) return sentences.slice(0, count);
  if (count === 2) {
    const mid = Math.floor(s.length * 0.48);
    const cut = s.lastIndexOf(" ", mid);
    if (cut > 18) return [s.slice(0, cut).trim(), s.slice(cut + 1).trim()].filter(Boolean);
  }
  if (count === 3 && s.length > 75) {
    const a = Math.floor(s.length * 0.25);
    const b = Math.floor(s.length * 0.62);
    const c1 = s.lastIndexOf(" ", a);
    const c2 = s.lastIndexOf(" ", b);
    if (c1 > 12 && c2 > c1 + 10) {
      return [s.slice(0, c1).trim(), s.slice(c1 + 1, c2).trim(), s.slice(c2 + 1).trim()].filter(Boolean);
    }
  }
  return [s];
}

export function fragmentReplyNaturally(args: {
  reply: string;
  userMessage: string;
  emotion?: string;
  seed: string;
}): { fragments: string[]; fragmented: boolean } {
  const c = pickCount(args.seed);
  const target = c === 1 ? 1 : c;
  const parts = target === 1 ? [String(args.reply ?? "").trim()] : splitNaturally(args.reply, target as 2 | 3);
  return { fragments: parts.filter(Boolean).slice(0, 3), fragmented: parts.length > 1 };
}

export function buildHumanFragments(args: {
  reply: string;
  userMessage: string;
  emotion?: string;
  socialOnlyMode?: boolean;
  seed: string;
  personality?: FragmentationPersonalityHints;
}): FragmentedReply {
  if (!shouldFragmentReply(args)) {
    console.log("[FRAGMENT_SKIPPED]", { reason: "rules", len: String(args.reply ?? "").trim().length });
    return {
      fragments: [
        {
          content: String(args.reply ?? "").trim(),
          delayMs: 0,
          typingDurationMs: 0,
          fragmentType: "main",
        },
      ],
      totalDurationMs: 0,
      fragmented: false,
    };
  }

  console.log("[FRAGMENTATION_ENABLED]", { emotion: args.emotion ?? "unknown" });
  const split = fragmentReplyNaturally(args);
  const typed = simulateTypingBursts({
    fragments: split.fragments.map((content, idx) => ({
      content,
      fragmentType: idx === 0 ? "reaction" : idx === split.fragments.length - 1 ? "main" : "validation",
    })),
    seed: args.seed,
    emotion: args.emotion,
  });
  let total = 0;
  for (const f of typed) {
    total += f.delayMs + f.typingDurationMs;
    console.log("[FRAGMENT_CREATED]", { type: f.fragmentType, len: f.content.length });
    console.log("[FRAGMENT_DELIVERY]", { type: f.fragmentType, delayMs: f.delayMs, typingDurationMs: f.typingDurationMs });
  }
  const score = clamp((typed.length - 1) * 0.45 + (args.emotion === "playful" || args.emotion === "warm" ? 0.2 : 0), 0, 1);
  console.log("[HUMANIZATION_FRAGMENT_SCORE]", { fragmented: split.fragmented, score });
  return {
    fragments: typed,
    totalDurationMs: total,
    fragmented: split.fragmented,
  };
}

