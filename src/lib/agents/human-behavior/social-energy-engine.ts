/**
 * Énergie sociale naturelle selon le moment de la journée + micro-variation d’humeur d’écriture.
 * Client + serveur.
 */

export type SocialDayPhase = "morning" | "afternoon" | "evening" | "late";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export function socialDayPhaseFromLocalHour(hour: number): SocialDayPhase {
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 17) return "afternoon";
  if (hour >= 18 && hour <= 22) return "evening";
  return "late";
}

/** Multiplicateur pensée / présence ( <1 = un peu plus vif, >1 = plus posé ). */
export function socialEnergyThinkMultiplier(phase: SocialDayPhase): number {
  switch (phase) {
    case "morning":
      return 0.92;
    case "afternoon":
      return 1.0;
    case "evening":
      return 1.04;
    case "late":
      return 1.14;
    default:
      return 1;
  }
}

export type MicroMood = {
  label: "warmer" | "faster" | "sober" | "focused";
  /** ~0.97–1.06 sur délais « think » côté client */
  paceMultiplier: number;
  /** léger biais tonal pour prompts (texte libre court) */
  toneHint: string;
};

const MOODS: MicroMood[] = [
  { label: "warmer", paceMultiplier: 1.02, toneHint: "légèrement plus chaleureux, toujours sobre" },
  { label: "faster", paceMultiplier: 0.97, toneHint: "un peu plus direct / rapide" },
  { label: "sober", paceMultiplier: 1.03, toneHint: "plus sobre, moins d’emphase" },
  { label: "focused", paceMultiplier: 1.01, toneHint: "plus concentré sur le fait utile" },
];

/** Variation d’humeur microscopique — une seule « teinte » par seed stable du tour. */
export function microMoodVariation(seed: string): MicroMood {
  return MOODS[seedHash(seed + "mood") % MOODS.length]!;
}

export function formatSocialEnergyPromptBlock(args: { lang: "fr" | "en" | "es"; localHour: number; moodSeed: string }): string {
  const phase = socialDayPhaseFromLocalHour(args.localHour);
  const mood = microMoodVariation(args.moodSeed);
  if (args.lang === "en") {
    return [
      "SOCIAL ENERGY (subtle realism):",
      `- Time band: ${phase} — morning a touch more dynamic; afternoon steady; late calmer/shorter.`,
      `- Micro mood this turn: ${mood.label} (${mood.toneHint}).`,
      "- Never announce energy shifts; just let length and warmth drift slightly.",
    ].join("\n");
  }
  if (args.lang === "es") {
    return [
      "ENERGÍA SOCIAL (realismo sutil):",
      `- Franja: ${phase} — mañana un poco más vivo; tarde estable; muy tarde más calmado/breve.`,
      `- Micro-ánimo del turno: ${mood.label}.`,
    ].join("\n");
  }
  return [
    "ÉNERGIE SOCIALE (réalisme psychologique léger):",
    `- Plage horaire locale : ${phase} — matin un peu plus dynamique ; après-midi stable ; très tard plus calme et plus court.`,
    `- Micro-humeur du tour : ${mood.label} — ${mood.toneHint}.`,
    "- Ne jamais « annoncer » son humeur ; laisser plutôt varier longueur et chaleur avec naturel.",
  ].join("\n");
}
