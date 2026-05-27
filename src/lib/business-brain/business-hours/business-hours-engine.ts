import "server-only";

import { DateTime } from "luxon";
import type { BusinessProfileLite, ExtendedBusinessFacts } from "../context/business-brain-args";

export function formatBusinessHoursEngineBlock(
  lang: "fr" | "en" | "es",
  profile: BusinessProfileLite,
  facts?: ExtendedBusinessFacts,
): string {
  const z = String(profile.businessIanaTimezone ?? "").trim() || "Africa/Douala";
  const now = DateTime.now().setZone(z);
  const wd = now.isValid ? now.weekday : 1;

  const isWeekendSlot = wd === 6 || wd === 7;

  const custom = [
    facts?.openHoursWeekday ? `Ouverture (semaine): ${facts.openHoursWeekday}` : null,
    facts?.weekendHoursNote ? `Week-end: ${facts.weekendHoursNote}` : null,
    facts?.lunchBreakNote ? `Pause: ${facts.lunchBreakNote}` : null,
    facts?.holidaysNote ? `Fériés / exceptions: ${facts.holidaysNote}` : null,
  ].filter(Boolean);

  const base =
    lang === "en"
      ? [
          "BUSINESS HOURS ENGINE:",
          "- Never invent opening hours; use CONFIG lines below OR say you verify.",
          `- Local business zone for reference: ${z}.`,
          isWeekendSlot ? "- Today’s weekday suggests weekend norms may apply — only state exact hours if configured." : null,
          ...custom,
        ].filter(Boolean)
      : lang === "es"
        ? [
            "HORARIO:",
            "- No inventar horas.",
            `- Zona: ${z}.`,
            ...custom,
          ].filter(Boolean)
        : [
            "HORAIRES BOUTIQUE :",
            "- Ne fabrique pas d’horaires — utilise les lignes CONFIG ci-dessous ou « je vous confirme ».",
            `- Fuseau de référence : ${z}.`,
            isWeekendSlot
              ? "- Week-end probable : précisions seulement si config / documents donnent les plages week-end."
              : null,
            ...custom,
          ].filter(Boolean);

  return base.join("\n");
}
