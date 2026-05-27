import type { PresenceUiLang } from "@/lib/agents/human-behavior/presence-engine";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export type ResponseBreathingBeat = { text: string; pauseAfterMs: number };

/** « Oui Monsieur. » [pause] « Je regarde. » — respiration ultra humaine. */
export function shouldInjectResponseBreathing(input: { userMessage: string; rushed: boolean; seed: string }): boolean {
  if (input.rushed) return false;
  const m = String(input.userMessage ?? "").trim();
  if (m.length < 18) return false;
  return seedHash(m + input.seed + "rb") % 100 < 12;
}

export function getResponseBreathingScript(lang: PresenceUiLang, seed: string): ResponseBreathingBeat[] {
  const h = seedHash(seed + "rbs");
  const p = 750 + (h % 1100);
  const hFr = frenchHonorificFromSeed(seed);
  if (lang === "en") {
    return [
      { text: "Yes sir.", pauseAfterMs: p },
      { text: "Let me check.", pauseAfterMs: 0 },
    ];
  }
  if (lang === "es") {
    return [
      { text: "Sí señor.", pauseAfterMs: p },
      { text: "Estoy mirando.", pauseAfterMs: 0 },
    ];
  }
  return [
    { text: hFr ? `Oui ${hFr}.` : "Oui.", pauseAfterMs: p },
    { text: "Je regarde.", pauseAfterMs: 0 },
  ];
}

function frenchHonorificFromSeed(seed: string): string | null {
  if (seedHash(seed) % 3 !== 0) return "Monsieur";
  return null;
}
