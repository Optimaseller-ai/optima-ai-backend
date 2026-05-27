import "server-only";

/**
 * Micro-réactions sociales — rares, jamais répétitives dans le fil.
 */

const MICRO_FR = [
  "Oui effectivement.",
  "Hmm je vois.",
  "Ah d’accord.",
  "Je comprends.",
  "D’accord oui.",
  "Oui je vois.",
];

const MICRO_EN = ["Right.", "I see.", "Hmm.", "Got it.", "Yeah.", "Fair."];
const MICRO_ES = ["Sí.", "Entiendo.", "Vale.", "Hmm.", "Claro.", "De acuerdo."];

function norm(s: string) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

export function stripRepeatedMicroReaction(text: string, lastAssistantLine?: string): string {
  let out = String(text ?? "").trim();
  const last = norm(lastAssistantLine ?? "");
  if (!last) return out;
  for (const m of [...MICRO_FR, ...MICRO_EN, ...MICRO_ES]) {
    const n = norm(m);
    if (last.startsWith(n.slice(0, 8)) && norm(out).startsWith(n.slice(0, 8))) {
      out = out.replace(new RegExp(`^${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "");
    }
  }
  return out.trim();
}

export function formatSocialMicroReactionsPromptBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return "SOCIAL MICRO-REACTIONS: rare (“I see.” “Right.”) — never the same hook twice in a row.";
  }
  if (lang === "es") {
    return "MICRO-REACCIONES: raras — no repetir la misma en mensajes seguidos.";
  }
  return "MICRO-RÉACTIONS : « Oui effectivement. » « Hmm je vois. » — rares, jamais deux fois de suite la même accroche.";
}
