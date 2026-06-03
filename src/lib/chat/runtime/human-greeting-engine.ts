import { logStructured } from "@/lib/logging/structured-log";
import {
  enforceGreetingTimeGuard,
  getLocalGreetingByTimezone,
  type TimeAwarenessInput,
} from "@/lib/chat/runtime/time-awareness-engine";

const ROBOTIC_GREETING_RE =
  /\b(comment puis-je|je peux vous aider|je suis l[àa] pour|dites-moi votre budget|je peux vous renseigner|n'hésitez pas|que recherchez-vous|vous cherchez quelque chose)\b/i;

function norm(s: string): string {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

function random01(seed: string): number {
  const x = Math.sin(hashSeed(seed)) * 10000;
  return x - Math.floor(x);
}

function pick<T>(seed: string, arr: readonly T[]): T {
  return arr[Math.floor(random01(seed) * arr.length)] ?? arr[0]!;
}

function isSimpleSalutation(message: string): boolean {
  const n = norm(message);
  return /^(salut|coucou|cc|hey|hello|hi|bjr|bonjour|bonsoir)[\s!.?👋🙂]*$/i.test(n) || n.length <= 12;
}

export function isRoboticGreetingReply(text: string): boolean {
  return ROBOTIC_GREETING_RE.test(String(text ?? ""));
}

export function pickHumanGreetingReply(args: {
  message: string;
  lang: "fr" | "en" | "es";
  seed: string;
  timezoneInput: TimeAwarenessInput;
  businessName?: string;
  agentName?: string;
  isFirstTurn: boolean;
}): string {
  const time = getLocalGreetingByTimezone(args.timezoneInput);
  const simple = isSimpleSalutation(args.message);

  if (args.lang !== "fr") {
    const greeting = time.hour >= 18 ? "Good evening" : "Hello";
    if (simple && random01(args.seed) < 0.35) return `${greeting} 🙂`;
    if (simple) return pick(args.seed, ["Hi 👋", "Hey", greeting] as const);
    return greeting;
  }

  if (simple) {
    const roll = random01(args.seed + "|salut");
    if (roll < 0.4) {
      const g = time.greeting;
      logStructured("[GREETING_SELECTED]", { greeting: g, mode: "time_greeting", hour: time.hour });
      const guarded = enforceGreetingTimeGuard({ reply: `${g} 🙂`, hour: time.hour, introDone: false });
      return guarded.reply;
    }
    if (roll < 0.8) {
      logStructured("[GREETING_SELECTED]", { greeting: "Salut", mode: "casual", hour: time.hour });
      return pick(args.seed + "|salut2", ["Salut 🙂", "Salut 👋", "Salut"] as const);
    }
    logStructured("[GREETING_SUPPRESSED]", { reason: "direct_no_salutation", hour: time.hour });
    if (args.isFirstTurn && args.agentName) {
      return pick(args.seed + "|direct", [`Salut, je suis ${args.agentName} 🙂`, "Salut 👋", "Hey 🙂"] as const);
    }
    return pick(args.seed + "|direct2", ["Salut 👋", "Hey 🙂", "Oui je suis là 🙂"] as const);
  }

  if (args.isFirstTurn) {
    const g = time.greeting;
    logStructured("[GREETING_SELECTED]", { greeting: g, mode: "first_turn_light", hour: time.hour });
    if (args.agentName && random01(args.seed + "|name") < 0.35) {
      return enforceGreetingTimeGuard({
        reply: `${g}, je suis ${args.agentName} 🙂`,
        hour: time.hour,
        introDone: false,
      }).reply;
    }
    if (args.businessName && random01(args.seed + "|biz") < 0.25) {
      return enforceGreetingTimeGuard({
        reply: `${g}, bienvenue chez ${args.businessName} 🙂`,
        hour: time.hour,
        introDone: false,
      }).reply;
    }
    return enforceGreetingTimeGuard({ reply: `${g} 🙂`, hour: time.hour, introDone: false }).reply;
  }

  const pool =
    time.hour >= 18
      ? (["Bonsoir 🙂", "Salut", "Bonsoir 👋"] as const)
      : (["Bonjour 🙂", "Salut", "Bonjour 👋"] as const);
  const out = pick(args.seed + "|ongoing", pool);
  logStructured("[GREETING_SELECTED]", { greeting: out, mode: "ongoing_light", hour: time.hour });
  return enforceGreetingTimeGuard({ reply: out, hour: time.hour, introDone: true }).reply;
}
