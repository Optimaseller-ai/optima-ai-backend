import "server-only";

import { DateTime } from "luxon";

import { formatBusinessLocalDateTime } from "@/lib/agents/timing/business-timezone";
import {
  frenchSalutationForLocalTime,
  greetingSlotFromLocalHour,
} from "@/lib/agents/memory/prospect-profile";

export type BusinessDaySlot = "morning" | "afternoon" | "evening" | "night";

export type BusinessTimeContext = {
  iana: string;
  city?: string;
  country?: string;
  wallClock: string | null;
  hour: number;
  minute: number;
  daySlot: BusinessDaySlot;
  /** Formule FR standard selon l’horloge locale (sans analyse du message prospect). */
  defaultFrenchSalutation: string;
};

export function buildBusinessTimeContext(args: {
  businessIanaTimezone?: string | null;
  city?: string | null;
  country?: string | null;
  now?: Date;
}): BusinessTimeContext {
  const iana = String(args.businessIanaTimezone ?? "").trim() || "Africa/Douala";
  const now = args.now ?? new Date();
  const dt = DateTime.fromJSDate(now).setZone(iana);
  const safe = dt.isValid ? dt : DateTime.fromJSDate(now).setZone("Africa/Douala");
  const fmt = formatBusinessLocalDateTime({ iana, now });
  const hour = safe.hour;
  const minute = safe.minute;
  const daySlot = greetingSlotFromLocalHour(hour, minute);
  const sal = frenchSalutationForLocalTime(safe);

  return {
    iana,
    city: args.city ?? undefined,
    country: args.country ?? undefined,
    wallClock: fmt?.wallClock ?? null,
    hour,
    minute,
    daySlot,
    defaultFrenchSalutation: sal.phraseFr,
  };
}
