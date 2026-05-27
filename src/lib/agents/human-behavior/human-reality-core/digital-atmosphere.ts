import "server-only";

import { DateTime } from "luxon";
import type { BusinessTimeContext } from "../timing/time-context";

export type DigitalAtmosphere =
  | "morning_calm"
  | "midday_busy"
  | "afternoon_steady"
  | "evening_soft"
  | "late_night_quiet"
  | "weekend_ease";

export type DigitalAtmosphereSnapshot = {
  atmosphere: DigitalAtmosphere;
  descriptionFr: string;
  replyBias: "crisp" | "relaxed" | "hushed";
};

export function inferDigitalAtmosphere(ctx: BusinessTimeContext, fatigue01: number, now = new Date()): DigitalAtmosphereSnapshot {
  const h = ctx.hour;
  const dow = DateTime.fromJSDate(now).setZone(ctx.iana).weekday;
  const isWeekend = dow === 6 || dow === 7;

  let atmosphere: DigitalAtmosphere = "afternoon_steady";
  let descriptionFr = "Après-midi habituelle au bureau.";
  let replyBias: DigitalAtmosphereSnapshot["replyBias"] = "crisp";

  if (h >= 22 || h < 6) {
    atmosphere = "late_night_quiet";
    descriptionFr = "Créneau tardif — ton plus posé, phrases plus courtes.";
    replyBias = "hushed";
  } else if (h >= 18 && h < 22) {
    atmosphere = "evening_soft";
    descriptionFr = "Fin de journée — ambiance un peu plus détendue.";
    replyBias = "relaxed";
  } else if (h >= 11 && h < 14) {
    atmosphere = "midday_busy";
    descriptionFr = "Milieu de journée souvent chargé — va droit au fait.";
    replyBias = "crisp";
  } else if (h >= 6 && h < 11) {
    atmosphere = "morning_calm";
    descriptionFr = "Matin — pro mais humain, sans lourdeur.";
    replyBias = "crisp";
  }

  if (isWeekend && h >= 10 && h < 20) {
    atmosphere = "weekend_ease";
    descriptionFr = "Ambiance week-end un peu plus cool — toujours pro.";
    replyBias = "relaxed";
  }

  if (fatigue01 > 0.55) {
    descriptionFr += " Fatigue du fil : moins verbeux.";
    replyBias = replyBias === "crisp" ? "relaxed" : replyBias;
  }

  return { atmosphere, descriptionFr, replyBias };
}
