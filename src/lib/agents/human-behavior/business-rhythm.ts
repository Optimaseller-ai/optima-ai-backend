/**
 * Rythme métier (matin / midi / soir / nuit / week-end) — prompts + léger impact délais client.
 * Luxon weekday: 1=lundi … 7=dimanche.
 */

export type BusinessRhythmBand = "weekend" | "morning" | "noon" | "evening" | "late_night";

function hourBand(hour: number, weekend: boolean): BusinessRhythmBand {
  if (weekend) return "weekend";
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 14) return "noon";
  if (hour >= 15 && hour <= 21) return "evening";
  return "late_night";
}

/** Heure + jour ISO boutique (Luxon weekday 1–7). */
export function businessRhythmBandFromLuxonParts(args: { hour: number; weekday: number }): BusinessRhythmBand {
  const weekend = args.weekday === 6 || args.weekday === 7;
  return hourBand(args.hour, weekend);
}

/** Côté client (navigateur) : getDay() 0=dimanche … 6=samedi. */
export function businessRhythmBandFromJsDate(d = new Date()): BusinessRhythmBand {
  const day = d.getDay();
  const weekend = day === 0 || day === 6;
  return hourBand(d.getHours(), weekend);
}

/** ~0.93–1.08 sur délais « think » / ressenti charge. */
export function businessRhythmDelayMultiplier(band: BusinessRhythmBand): number {
  switch (band) {
    case "morning":
      return 0.96;
    case "noon":
      return 1.02;
    case "evening":
      return 1.0;
    case "late_night":
      return 1.07;
    case "weekend":
      return 1.04;
    default:
      return 1;
  }
}

export function formatBusinessRhythmPromptBlock(band: BusinessRhythmBand, lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    const spirit: Record<BusinessRhythmBand, string> = {
      weekend: "Weekend vibe: calmer, slightly shorter; no rush tone.",
      morning: "Morning: a bit more awake/direct; still professional.",
      noon: "Midday: steady, practical; short confirmations OK.",
      evening: "Evening: calmer pacing; avoid hype.",
      late_night: "Late night: very calm, very short; human tired-employee realism.",
    };
    return `BUSINESS RHYTHM (${band}): ${spirit[band]}`;
  }
  if (lang === "es") {
    const spirit: Record<BusinessRhythmBand, string> = {
      weekend: "Fin de semana: más calmado y breve.",
      morning: "Mañana: un poco más directo.",
      noon: "Mediodía: práctico y estable.",
      evening: "Tarde/noche temprana: ritmo calmado.",
      late_night: "Muy tarde: muy breve y calmado.",
    };
    return `RITMO NEGOCIO (${band}): ${spirit[band]}`;
  }
  const spirit: Record<BusinessRhythmBand, string> = {
    weekend: "Week-end : un peu plus posé, messages un peu plus courts.",
    morning: "Matin : léger regain d’énergie pro, direct sans agresser.",
    noon: "Midi : efficace, stable, confirmations courtes.",
    evening: "Soir : rythme plus calme, moins d’emphase.",
    late_night: "Nuit : très sobre, très court, humain « fin de journée ».",
  };
  return `RYTHME MÉTIER (${band}) : ${spirit[band]}`;
}
