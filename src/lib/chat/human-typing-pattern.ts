/**
 * Rythme « frappe humaine » : micro-pauses pendant l’attente de la réponse réseau.
 */

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export type HumanTypingPatternInput = {
  fatigue01: number;
  rushed: boolean;
  userMessageLen: number;
  elapsedWaitMs: number;
};

/**
 * Indique si on coupe brièvement l’indicateur « en train d’écrire » (faux arrêt / reprise).
 */
export function shouldHumanTypingInterrupt(input: HumanTypingPatternInput): boolean {
  if (input.rushed || input.elapsedWaitMs < 950) return false;
  const p = 0.14 + 0.26 * clamp(0, input.fatigue01, 1) + (input.userMessageLen > 95 ? 0.1 : 0);
  return Math.random() < Math.min(0.62, p);
}

export function humanTypingPauseMs(): number {
  return 240 + Math.round(Math.random() * 920);
}

/** Deuxième vague d’interruptions (plus rare) pour allonger la présence humaine. */
export function shouldSecondaryTypingInterrupt(input: HumanTypingPatternInput): boolean {
  if (input.rushed || input.elapsedWaitMs < 3200) return false;
  const p = 0.08 + 0.14 * clamp(0, input.fatigue01, 1);
  return Math.random() < p;
}
