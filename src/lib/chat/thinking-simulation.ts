import type { PresenceUiLang } from "@/lib/agents/human-behavior/presence-engine";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export type ThinkingBeat = { text: string; pauseAfterMs: number };

/** Interruption « Oui attendez. » → pause → « Je regarde. » (ultra humain). */
export function shouldInjectThinkingInterruption(input: { userMessage: string; rushed: boolean }): boolean {
  if (input.rushed) return false;
  const m = String(input.userMessage ?? "").trim();
  if (m.length < 25) return false;
  const needsThink =
    m.length > 70 ||
    /(stock|prix|dispo|modèle|modele|livraison|compar|budget|garantie|taille|couleur)/i.test(m);
  if (!needsThink) return false;
  return seedHash(m + "thinkint") % 100 < 14;
}

export function getThinkingInterruptionScript(lang: PresenceUiLang, seed: string): ThinkingBeat[] {
  const h = seedHash(seed + "ti");
  const p = 900 + (h % 1400);
  if (lang === "en") {
    return [
      { text: "Yes — hang on.", pauseAfterMs: p },
      { text: "I’m checking that.", pauseAfterMs: 0 },
    ];
  }
  if (lang === "es") {
    return [
      { text: "Sí, un momento.", pauseAfterMs: p },
      { text: "Estoy mirando eso.", pauseAfterMs: 0 },
    ];
  }
  return [
    { text: "Oui attendez.", pauseAfterMs: p },
    { text: "Je regarde cela.", pauseAfterMs: 0 },
  ];
}

/** Micro-beat réflexion seul (prompt / rare interlude). */
export function pickThinkingMicroLine(lang: PresenceUiLang, seed: string): string | null {
  if (seedHash(seed + "thmicro") % 100 >= 8) return null;
  const fr = ["Hmm…", "Attendez.", "Je réfléchis à une meilleure option.", "Je pense avoir quelque chose."];
  const en = ["Hmm…", "Hang on.", "Thinking of a better option.", "I might have something."];
  const es = ["Mmm…", "Un momento.", "Estoy pensando en otra opción.", "Creo que tengo algo."];
  const pool = lang === "en" ? en : lang === "es" ? es : fr;
  return pool[seedHash(seed) % pool.length] ?? null;
}
