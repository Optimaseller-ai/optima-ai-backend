import type { BusinessRhythmBand } from "./business-rhythm";

export type BusinessPressureLevel = "calm" | "normal" | "busy";

export function inferBusinessPressureLevel(args: {
  rhythmBand: BusinessRhythmBand;
  turnCount?: number;
  hour: number;
}): BusinessPressureLevel {
  const { rhythmBand, turnCount = 0, hour } = args;
  if (rhythmBand === "noon" && hour >= 12 && hour <= 14) return "busy";
  if (rhythmBand === "evening" && turnCount > 8) return "busy";
  if (rhythmBand === "late_night") return "calm";
  return "normal";
}

export function formatHumanizedBusinessPressureBlock(level: BusinessPressureLevel, lang: "fr" | "en" | "es"): string | null {
  if (level === "normal") return null;
  if (lang === "en") {
    return level === "busy"
      ? "BUSINESS PRESSURE: store feels busy — slightly shorter, quicker tone; tiny delays OK; still professional."
      : "BUSINESS PRESSURE: calm moment — unhurried, human pace.";
  }
  if (lang === "es") {
    return level === "busy" ? "PRESIÓN ACTIVIDAD: más ocupado — respuestas un poco más cortas." : null;
  }
  return level === "busy"
    ? "PRESSION ACTIVITÉ : journée chargée — réponses un peu plus courtes, ton un peu plus rapide, légers délais crédibles — toujours pro."
    : "ACTIVITÉ calme — rythme posé, pas pressé.";
}

export function businessPressureThinkMultiplier(level: BusinessPressureLevel): number {
  switch (level) {
    case "busy":
      return 1.08;
    case "calm":
      return 1.04;
    default:
      return 1;
  }
}

export function businessPressureMaxChars(level: BusinessPressureLevel, base: number): number {
  if (level === "busy") return Math.round(base * 0.88);
  return base;
}
