import "server-only";

import type { BusinessDaySlot } from "@/lib/agents/human-behavior/timing/time-context";

export type DigitalEnergyLevel = "calm_morning" | "active_afternoon" | "warm_evening" | "low_end_of_day";

export type DigitalEnergySnapshot = {
  level: DigitalEnergyLevel;
  /** 0–1 — énergie conversationnelle suggérée */
  score: number;
  hintFr: string;
};

export function resolveDigitalEnergy(daySlot: BusinessDaySlot, hourLocal: number): DigitalEnergySnapshot {
  if (daySlot === "morning" || (hourLocal >= 6 && hourLocal < 11)) {
    return {
      level: "calm_morning",
      score: 0.72,
      hintFr: "Matin : posé, clair, pas de rush — phrases nettes, ton pro mais détendu.",
    };
  }
  if (daySlot === "afternoon" || (hourLocal >= 11 && hourLocal < 17)) {
    return {
      level: "active_afternoon",
      score: 0.88,
      hintFr: "Après-midi : plus réactif, rythme un peu plus vif, toujours humain.",
    };
  }
  if (daySlot === "evening" || (hourLocal >= 17 && hourLocal < 21)) {
    return {
      level: "warm_evening",
      score: 0.78,
      hintFr: "Soirée : chaleureux, moins formel, phrases un peu plus courtes.",
    };
  }
  return {
    level: "low_end_of_day",
    score: 0.58,
    hintFr: "Fin de journée : calme, sobre, pas de longues explications.",
  };
}

export function formatDigitalEnergyPromptBlock(
  snap: DigitalEnergySnapshot,
  lang: "fr" | "en" | "es",
): string {
  if (lang === "en") {
    return `WHATSAPP ENERGY (${snap.level}): ${snap.hintFr.replace(/Matin|Après-midi|Soirée|Fin de journée/g, (m) => m)} — match a real mobile advisor pace, not a helpdesk.`;
  }
  if (lang === "es") {
    return `ENERGÍA WHATSAPP (${snap.level}): ritmo humano móvil, no soporte frío.`;
  }
  return `ÉNERGIE WHATSAPP (${snap.level}) : ${snap.hintFr}`;
}
