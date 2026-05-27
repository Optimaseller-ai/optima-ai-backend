import { DateTime } from "luxon";

/**
 * Fenêtre locale où une action automatique (relance, etc.) est déconseillée.
 * Repousse au prochain créneau autorisé (9h locale).
 */
export function snapUtcInstantOutOfQuietHours(utcMs: number, businessIanaTimezone: string): number {
  const zone = String(businessIanaTimezone ?? "").trim() || "Africa/Douala";
  const dt = DateTime.fromMillis(utcMs, { zone: "utc" }).setZone(zone);
  if (!dt.isValid) return utcMs;

  const h = dt.hour;
  const inQuiet = h >= 22 || h < 9;
  if (!inQuiet) return utcMs;

  let target: DateTime;
  if (h >= 22) {
    target = dt.startOf("day").plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
  } else {
    target = dt.startOf("day").set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
    if (target.toMillis() <= dt.toMillis()) {
      target = target.plus({ days: 1 });
    }
  }
  return target.toUTC().toMillis();
}
