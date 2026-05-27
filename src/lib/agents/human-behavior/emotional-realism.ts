/**
 * Réactions émotionnelles crédibles — pas empathie type support IA.
 */

export type EmotionalRealismLang = "fr" | "en" | "es";

export function detectProspectEmotionalVent(message: string): "fatigue" | "stress" | "discouraged" | null {
  const t = String(message ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  if (/\b(franchement\s+je\s+suis\s+fatigu|je\s+suis\s+fatigu|crevé|creve|épuis)\b/i.test(t)) return "fatigue";
  if (/\b(stress|angoiss|débordé|deborde)\b/i.test(t)) return "stress";
  if (/\b(décourag|decourag|ras\s*le\s*bol)\b/i.test(t)) return "discouraged";
  return null;
}

export function formatEmotionalRealismPromptBlock(lang: EmotionalRealismLang): string {
  if (lang === "en") {
    return [
      "EMOTIONAL REALISM:",
      "- If they vent (tired, stressed): short human lines — “I see.” “Long days happen.” — NOT “I understand your fatigue”.",
    ].join("\n");
  }
  if (lang === "es") {
    return "REALISMO EMOCIONAL: si está cansado — breve y humano; no «entiendo su fatiga» corporativo.";
  }
  return [
    "RÉALISME ÉMOTIONNEL:",
    "- Si le prospect exprime fatigue / stress : « Oui je vois. » « Les journées sont longues parfois. » — INTERDIT « Je comprends votre fatigue » / empathie hotline.",
  ].join("\n");
}

/** Réécriture sortie modèle. */
export function repairEmotionalRealism(text: string, lang: EmotionalRealismLang): string {
  let out = String(text ?? "").trim();
  if (!out) return out;
  const reps: [RegExp, string][] =
    lang === "en"
      ? [
          [/\bI\s+understand\s+your\s+fatigue\b[\s.,!?…]*/gi, "I see. "],
          [/\bI\s+understand\s+that\s+you(?:'re|\s+are)\s+tired\b[\s.,!?…]*/gi, "Long days happen sometimes. "],
        ]
      : lang === "es"
        ? [
          [/\bentiendo\s+su\s+fatiga\b[\s.,!?…]*/gi, "Lo entiendo. "],
          [/\bcomprendo\s+su\s+cansancio\b[\s.,!?…]*/gi, "Sí, se nota. "],
        ]
        : [
            [/\bje\s+comprends\s+votre\s+fatigue\b[\s.,!?…]*/gi, "Oui je vois. "],
            [/\bje\s+comprends\s+que\s+vous\s+êtes\s+fatigué\b[\s.,!?…]*/gi, "Les journées sont longues parfois. "],
          ];
  for (const [re, rep] of reps) out = out.replace(re, rep);
  return out.replace(/\s{2,}/g, " ").trim();
}
