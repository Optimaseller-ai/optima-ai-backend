import { logStructured } from "@/lib/logging/structured-log";
import {
  getLocalGreetingByTimezone,
  type TimeAwarenessInput,
} from "@/lib/chat/runtime/time-awareness-engine";

export type TemporalGreetingResult = {
  greeting: string;
  hour: number;
  minute: number;
  timezone: string;
};

/**
 * Greeting by local wall clock (default Africa/Douala via time-awareness resolver).
 * 05–11 → Bonjour | 12–17 → Bonjour | 18–23 → Bonsoir | 00–04 → Salut (late-night Bonsoir avoided).
 */
export function buildTemporalGreeting(input: TimeAwarenessInput = {}): TemporalGreetingResult {
  const ctx = getLocalGreetingByTimezone(input);
  const h = ctx.hour;
  let greeting: string;
  if (h >= 5 && h < 12) greeting = "Bonjour";
  else if (h >= 12 && h < 18) greeting = "Bonjour";
  else if (h >= 18 && h <= 23) greeting = "Bonsoir";
  else greeting = "Salut";

  logStructured("[TEMPORAL_GREETING]", { greeting, hour: h, minute: ctx.minute, timezone: ctx.timezone });
  logStructured("[TIMEZONE_CONTEXT]", { timezone: ctx.timezone, hour: h, minute: ctx.minute, period: ctx.period });

  return { greeting, hour: h, minute: ctx.minute, timezone: ctx.timezone };
}

export function buildSingleIntroMessage(args: {
  businessName: string;
  agentName: string;
  timezoneInput?: TimeAwarenessInput;
}): string {
  const { greeting } = buildTemporalGreeting(args.timezoneInput ?? {});
  const biz = String(args.businessName ?? "").trim() || "notre boutique";
  const agent = String(args.agentName ?? "").trim() || "votre conseiller";
  return `${greeting}, bienvenue chez ${biz}. Je suis ${agent}.`;
}
