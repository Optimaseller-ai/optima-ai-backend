import { DateTime } from "luxon";

export const DEFAULT_TIMEZONE = "Africa/Douala";

export type ResolvedDateTime = {
  zone: string;
  iso: string;
  displayDate: string; // DD/MM/YYYY
  displayTime: string; // HH:mm
};

export type DateTimeParseResult =
  | { ok: true; value: ResolvedDateTime; reason: string }
  | { ok: false; reason: string };

export function nowInDefaultZone() {
  return DateTime.now().setZone(DEFAULT_TIMEZONE);
}

export function formatFrenchDate(dt: DateTime) {
  return dt.setLocale("fr").toFormat("dd/LL/yyyy");
}

export function formatFrenchTime(dt: DateTime) {
  return dt.setLocale("fr").toFormat("HH:mm");
}

export function toResolvedDateTime(dt: DateTime): ResolvedDateTime {
  const zoned = dt.setZone(DEFAULT_TIMEZONE);
  return {
    zone: DEFAULT_TIMEZONE,
    iso: zoned.toISO() ?? zoned.toUTC().toISO() ?? new Date().toISOString(),
    displayDate: formatFrenchDate(zoned),
    displayTime: formatFrenchTime(zoned),
  };
}

function clampFuture(dt: DateTime, now: DateTime) {
  if (dt < now) return now;
  return dt;
}

function parseTimePart(text: string): { hour: number; minute: number } | null {
  // Examples:
  // - 8h, 8h30, 08h05
  // - 14h, 14:20
  // - 8pm / 8 pm / 8 am
  // - 9h du matin / 9h du soir / 9h de l'apres-midi
  const cleaned = text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const match = cleaned.match(
    /\b(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(am|pm)?\b|\b(\d{1,2})\s*(am|pm)\b/,
  );
  if (!match) return null;

  let hourRaw: number | null = null;
  let minuteRaw: number | null = null;
  let ampm: string | null = null;

  if (match[1]) {
    hourRaw = Number(match[1]);
    minuteRaw = match[2] ? Number(match[2]) : 0;
    ampm = match[3] ?? null;
  } else if (match[4]) {
    hourRaw = Number(match[4]);
    minuteRaw = 0;
    ampm = match[5] ?? null;
  }

  if (hourRaw === null || Number.isNaN(hourRaw)) return null;
  if (minuteRaw === null || Number.isNaN(minuteRaw)) return null;
  if (hourRaw < 0 || hourRaw > 23) return null;
  if (minuteRaw < 0 || minuteRaw > 59) return null;

  let hour = hourRaw;
  const minute = minuteRaw;

  const hasMorning =
    /\b(matin|am)\b/.test(cleaned) || /\bdu matin\b/.test(cleaned) || /\bam\b/.test(cleaned);
  const hasEvening =
    /\b(soir|nuit|pm)\b/.test(cleaned) ||
    /\bdu soir\b/.test(cleaned) ||
    /\bde l'apres-midi\b/.test(cleaned) ||
    /\bde l'après-midi\b/.test(cleaned) ||
    /\bpm\b/.test(cleaned);

  if (ampm === "pm") {
    if (hour >= 1 && hour <= 11) hour += 12;
  } else if (ampm === "am") {
    if (hour === 12) hour = 0;
  } else if (hasEvening && hour >= 1 && hour <= 11) {
    hour += 12;
  } else if (hasMorning && hour === 12) {
    hour = 0;
  }

  return { hour, minute };
}

function parseWeekday(text: string): number | null {
  // Luxon weekday: Monday=1 ... Sunday=7
  const t = text.toLowerCase();
  if (t.includes("lundi")) return 1;
  if (t.includes("mardi")) return 2;
  if (t.includes("mercredi")) return 3;
  if (t.includes("jeudi")) return 4;
  if (t.includes("vendredi")) return 5;
  if (t.includes("samedi")) return 6;
  if (t.includes("dimanche")) return 7;
  return null;
}

function nextWeekdayOccurrence(now: DateTime, weekday: number, opts?: { strictFuture?: boolean }) {
  const strictFuture = opts?.strictFuture ?? true;
  const current = now.weekday; // 1..7
  let delta = (weekday - current + 7) % 7;
  if (delta === 0 && strictFuture) delta = 7;
  return now.plus({ days: delta });
}

function parseExplicitDate(text: string, now: DateTime): DateTime | null {
  // Accepts:
  // - DD/MM/YYYY
  // - DD-MM-YYYY
  // - DD/MM (assumes current year)
  const cleaned = text.replace(/\s+/g, " ").trim();
  const m = cleaned.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (!m) return null;

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : now.year;
  if ([day, month, year].some((n) => Number.isNaN(n))) return null;

  const dt = DateTime.fromObject(
    { year, month, day, hour: 0, minute: 0, second: 0, millisecond: 0 },
    { zone: DEFAULT_TIMEZONE },
  );
  if (!dt.isValid) return null;
  return dt;
}

/**
 * Parses common French natural-language date/time requests and resolves them
 * to an exact calendar date/time in Africa/Douala.
 *
 * It is intentionally conservative: if no clear signal is found, returns ok=false.
 */
export function parseNaturalLanguageDateTime(text: string, now?: DateTime): DateTimeParseResult {
  const baseNow = (now ?? nowInDefaultZone()).setZone(DEFAULT_TIMEZONE);
  const cleaned = text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const time = parseTimePart(cleaned);

  // 1) Explicit date like 25/04/2026 (optionally with time).
  const explicitDate = parseExplicitDate(cleaned, baseNow);
  if (explicitDate) {
    const withTime = time
      ? explicitDate.set({ hour: time.hour, minute: time.minute })
      : explicitDate.set({ hour: 9, minute: 0 });
    if (withTime < baseNow) return { ok: false, reason: "past_explicit_date" };
    return { ok: true, value: toResolvedDateTime(withTime), reason: "explicit_date" };
  }

  // 2) Relative phrases
  if (/\b(demain)\b/.test(cleaned)) {
    const date = baseNow.plus({ days: 1 }).startOf("day");
    const withTime = time ? date.set(time) : date.set({ hour: 9, minute: 0 });
    return { ok: true, value: toResolvedDateTime(withTime), reason: "tomorrow" };
  }

  const inDays = cleaned.match(/\b(dans)\s+(\d{1,2})\s+jours?\b/);
  if (inDays) {
    const days = Number(inDays[2]);
    if (!Number.isNaN(days) && days >= 0 && days <= 365) {
      const date = baseNow.plus({ days }).startOf("day");
      const withTime = time ? date.set(time) : date.set({ hour: 9, minute: 0 });
      const final = clampFuture(withTime, baseNow);
      return { ok: true, value: toResolvedDateTime(final), reason: "in_days" };
    }
    return { ok: false, reason: "invalid_relative_days" };
  }

  if (/\bce soir\b/.test(cleaned) || /\bce soir même\b/.test(cleaned) || /\bce soir meme\b/.test(cleaned)) {
    const date = baseNow.startOf("day");
    const withTime = time ? date.set(time) : date.set({ hour: 20, minute: 0 });
    const final = withTime < baseNow ? withTime.plus({ days: 1 }) : withTime;
    return { ok: true, value: toResolvedDateTime(final), reason: "tonight" };
  }

  // 3) Weekday expressions: "lundi a 9h", "vendredi prochain 14h"
  const weekday = parseWeekday(cleaned);
  if (weekday) {
    const strictFuture = /\bprochain\b/.test(cleaned);
    let targetDate = nextWeekdayOccurrence(baseNow, weekday, { strictFuture });
    targetDate = targetDate.startOf("day");
    const withTime = time ? targetDate.set(time) : targetDate.set({ hour: 9, minute: 0 });

    // If user didn't say "prochain" and today is that weekday, allow same-day if time is still ahead.
    if (!strictFuture && baseNow.weekday === weekday && time) {
      const sameDay = baseNow.startOf("day").set(time);
      if (sameDay >= baseNow) {
        return { ok: true, value: toResolvedDateTime(sameDay), reason: "weekday_same_day" };
      }
      const nextWeek = sameDay.plus({ days: 7 });
      return { ok: true, value: toResolvedDateTime(nextWeek), reason: "weekday_next_week" };
    }

    if (withTime < baseNow) {
      // Conservative: if the computed time is already passed, pick the next occurrence.
      const next = withTime.plus({ days: 7 });
      return { ok: true, value: toResolvedDateTime(next), reason: "weekday_next_week" };
    }

    return { ok: true, value: toResolvedDateTime(withTime), reason: "weekday" };
  }

  // 4) Next week / this weekend (pick a representative exact date)
  if (/\b(semaine prochaine|la semaine prochaine|next week)\b/.test(cleaned)) {
    // Next Monday at 09:00 (French weeks commonly start on Monday).
    const nextMonday = nextWeekdayOccurrence(baseNow, 1, { strictFuture: true }).startOf("day");
    const withTime = time ? nextMonday.set(time) : nextMonday.set({ hour: 9, minute: 0 });
    return { ok: true, value: toResolvedDateTime(withTime), reason: "next_week" };
  }

  if (/\b(ce week-?end|ce weekend|this weekend)\b/.test(cleaned)) {
    // Next Saturday at 10:00 (or today if already weekend and time permits).
    const isWeekendToday = baseNow.weekday === 6 || baseNow.weekday === 7;
    const base = isWeekendToday
      ? baseNow.startOf("day")
      : nextWeekdayOccurrence(baseNow, 6, { strictFuture: false }).startOf("day");
    const withTime = time ? base.set(time) : base.set({ hour: 10, minute: 0 });
    const final = clampFuture(withTime, baseNow);
    return { ok: true, value: toResolvedDateTime(final), reason: "this_weekend" };
  }

  return { ok: false, reason: "no_match" };
}

export function buildTimestampContext(now?: DateTime) {
  const dt = (now ?? nowInDefaultZone()).setZone(DEFAULT_TIMEZONE);
  return {
    zone: DEFAULT_TIMEZONE,
    iso: dt.toISO() ?? new Date().toISOString(),
    display: `${formatFrenchDate(dt)} ${formatFrenchTime(dt)}`,
  };
}
