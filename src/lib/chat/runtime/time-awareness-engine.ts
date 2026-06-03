import { DateTime } from "luxon";
import { logStructured } from "@/lib/logging/structured-log";

export type GreetingPeriod = "morning" | "afternoon" | "evening" | "night";

export type LocalTimeContext = {
  hour: number;
  minute: number;
  timezone: string;
  period: GreetingPeriod;
  greeting: "Bonjour" | "Bonsoir";
};

export type TimeAwarenessInput = {
  sessionTimezone?: string | null;
  userTimezone?: string | null;
  browserTimezone?: string | null;
  businessTimezone?: string | null;
  now?: number;
};

const FALLBACK_TZ = "Africa/Douala";

function normTz(v?: string | null): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const dt = DateTime.now().setZone(s);
  return dt.isValid ? s : "";
}

export function resolveSessionTimezone(input: TimeAwarenessInput): { timezone: string; source: string } {
  const candidates: Array<{ tz: string; source: string }> = [
    { tz: normTz(input.sessionTimezone), source: "session" },
    { tz: normTz(input.userTimezone), source: "user" },
    { tz: normTz(input.browserTimezone), source: "browser" },
    { tz: normTz(input.businessTimezone), source: "business" },
    { tz: FALLBACK_TZ, source: "fallback" },
  ];
  for (const c of candidates) {
    if (c.tz) {
      logStructured("[TIMEZONE_RESOLVED]", { timezone: c.tz, source: c.source });
      return { timezone: c.tz, source: c.source };
    }
  }
  logStructured("[TIMEZONE_RESOLVED]", { timezone: FALLBACK_TZ, source: "fallback" });
  return { timezone: FALLBACK_TZ, source: "fallback" };
}

export function detectGreetingPeriod(hour: number): {
  period: GreetingPeriod;
  greeting: "Bonjour" | "Bonsoir";
  periodLabelFr: string;
} {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  if (h >= 5 && h < 12) {
    return { period: "morning", greeting: "Bonjour", periodLabelFr: "matin" };
  }
  if (h >= 12 && h < 18) {
    return { period: "afternoon", greeting: "Bonjour", periodLabelFr: "après-midi" };
  }
  if (h >= 18 && h <= 23) {
    return { period: "evening", greeting: "Bonsoir", periodLabelFr: "soirée" };
  }
  return { period: "night", greeting: "Bonsoir", periodLabelFr: "nuit" };
}

export function getLocalTimeContext(input: TimeAwarenessInput): LocalTimeContext {
  const { timezone } = resolveSessionTimezone(input);
  const nowMs = typeof input.now === "number" ? input.now : Date.now();
  const dt = DateTime.fromMillis(nowMs, { zone: timezone });
  const safe = dt.isValid ? dt : DateTime.now().setZone(FALLBACK_TZ);
  const hour = safe.hour;
  const minute = safe.minute;
  const { period, greeting } = detectGreetingPeriod(hour);

  const ctx: LocalTimeContext = { hour, minute, timezone, period, greeting };
  logStructured("[TIME_CONTEXT]", ctx);
  logStructured("[GREETING_PERIOD]", { period, hour, greeting });
  return ctx;
}

function userMessageHasGreeting(message: string): boolean {
  return /\b(bonjour|bonsoir|salut|bsr|bjr|hello|hi|hey|coucou)\b/i.test(String(message ?? ""));
}

function isDirectBusinessMessage(message: string): boolean {
  const m = String(message ?? "").trim();
  if (!m) return false;
  if (userMessageHasGreeting(m)) return false;
  return /\?/.test(m) || /\b(prix|produit|commande|dispo|catalogue|airpods|iphone|livraison)\b/i.test(m);
}

export function buildGreetingContext(args: {
  time: LocalTimeContext;
  introDone?: boolean;
  welcomeDone?: boolean;
  userMessage: string;
  lang?: "fr" | "en" | "es";
}): {
  promptBlock: string;
  recommendedGreeting: "Bonjour" | "Bonsoir" | null;
  skipGreeting: boolean;
} {
  const lang = args.lang ?? "fr";
  const introDone = args.introDone === true || args.welcomeDone === true;
  const direct = isDirectBusinessMessage(args.userMessage);
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeLine =
    lang === "fr"
      ? `Heure locale actuelle du prospect : ${args.time.hour}h${pad(args.time.minute)}.`
      : `Prospect local time: ${args.time.hour}:${pad(args.time.minute)}.`;
  const periodFr =
    args.time.period === "morning"
      ? "matin"
      : args.time.period === "afternoon"
        ? "après-midi"
        : args.time.period === "evening"
          ? "soirée"
          : "nuit";
  const periodLine = lang === "fr" ? `Période : ${periodFr}.` : `Period: ${args.time.period}.`;

  if (introDone) {
    logStructured("[GREETING_SKIPPED_ALREADY_INTRODUCED]", {
      introDone: true,
      hour: args.time.hour,
    });
    const block = [
      timeLine,
      periodLine,
      lang === "fr"
        ? "Conversation déjà engagée : ne rouvre pas par « Bonjour » ou « Bonsoir »."
        : "Conversation already started: do not reopen with a full greeting.",
      lang === "fr"
        ? "Règle stricte : ne jamais dire « Bonsoir » avant 18h."
        : "Strict: never say Bonsoir before 6pm local.",
      direct && lang === "fr"
        ? "Le prospect va droit au sujet : réponds directement sans salutation forcée."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { promptBlock: block, recommendedGreeting: null, skipGreeting: true };
  }

  if (direct) {
    logStructured("[GREETING_SELECTED]", { greeting: null, reason: "direct_business_message", hour: args.time.hour });
    const block = [
      timeLine,
      periodLine,
      lang === "fr"
        ? "Le prospect n'a pas salué et va droit au sujet : ne force pas « Bonjour » ou « Bonsoir », réponds naturellement au fond."
        : "Prospect skipped greeting and asked directly: answer the point without forced greeting.",
      lang === "fr"
        ? `Si salutation vraiment nécessaire au premier contact uniquement : « ${args.time.greeting} » (jamais « Bonsoir » avant 18h).`
        : `If greeting needed on true first contact only: "${args.time.greeting}".`,
    ].join("\n");
    return { promptBlock: block, recommendedGreeting: null, skipGreeting: true };
  }

  logStructured("[GREETING_SELECTED]", { greeting: args.time.greeting, hour: args.time.hour, period: args.time.period });
  const greetingLine =
    lang === "fr"
      ? `Salutation naturelle recommandée : « ${args.time.greeting} ».`
      : `Natural greeting: "${args.time.greeting}".`;
  const strictLine =
    lang === "fr"
      ? "Règle stricte : ne jamais dire « Bonsoir » avant 18h."
      : "Strict: never say Bonsoir before 6pm local.";
  return {
    promptBlock: [timeLine, periodLine, greetingLine, strictLine].join("\n"),
    recommendedGreeting: args.time.greeting,
    skipGreeting: false,
  };
}

/** Hard guard: block Bonsoir before 18h local; strip leading greetings when intro already done. */
export function enforceGreetingTimeGuard(args: {
  reply: string;
  hour: number;
  introDone?: boolean;
}): { reply: string; adjusted: boolean; reason?: string } {
  let out = String(args.reply ?? "").trim();
  if (!out) return { reply: out, adjusted: false };

  let adjusted = false;
  let reason: string | undefined;

  if (args.hour < 18 && /^bonsoir\b/i.test(out)) {
    out = out.replace(/^bonsoir\b[,\s!.-]*/i, "Bonjour ");
    adjusted = true;
    reason = "bonsoir_blocked_before_18h";
  }

  if (args.introDone && /^(bonjour|bonsoir|salut)\b[,\s!.-]*/i.test(out)) {
    out = out.replace(/^(bonjour|bonsoir|salut)\b[,\s!.-]*/i, "").trim();
    if (out) {
      adjusted = true;
      reason = reason ? `${reason}+intro_greeting_stripped` : "intro_greeting_stripped";
    }
  }

  return { reply: out, adjusted, reason };
}
