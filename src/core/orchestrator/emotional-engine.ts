/** Emotional engine — phase 2 (continuité émotionnelle). */
export type EmotionalSnapshot = {
  frustrationScore: number;
  blocksSocialQuick: boolean;
};

export function analyzeEmotion(_message: string): EmotionalSnapshot {
  return { frustrationScore: 0, blocksSocialQuick: false };
}
