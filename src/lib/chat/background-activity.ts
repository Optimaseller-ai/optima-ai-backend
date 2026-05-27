import type { PresenceUiLang } from "@/lib/agents/human-behavior/presence-engine";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export type BackgroundBeat = { text: string; pauseAfterMs: number };

/**
 * Flux court « occupé » avant la frappe principale (2 temps + pauses réalistes).
 */
export function shouldInjectBackgroundActivity(input: { userMessage: string; rushed: boolean }): boolean {
  if (input.rushed) return false;
  const m = String(input.userMessage ?? "").trim();
  if (m.length < 40) return false;
  const complex =
    m.length > 92 ||
    /(stock|prix|dispo|disponible|livraison|taille|couleur|commande|fcfa|cfa|modèle|modele|garantie|paiement|adresse|urgent)/i.test(m);
  const h = seedHash(m + "bgact");
  return complex && h % 100 < 17;
}

export function getBackgroundActivityScript(lang: PresenceUiLang, seed: string): BackgroundBeat[] {
  const h = seedHash(seed + "bg");
  const j1 = 7200 + (h % 3800);
  const j2 = 9800 + ((h >>> 5) % 5200);
  if (lang === "en") {
    return [
      { text: "One moment sir.", pauseAfterMs: j1 },
      { text: "I’m checking that now.", pauseAfterMs: j2 },
    ];
  }
  if (lang === "es") {
    return [
      { text: "Un momento señor.", pauseAfterMs: j1 },
      { text: "Estoy mirando eso.", pauseAfterMs: j2 },
    ];
  }
  return [
    { text: "Un instant Monsieur.", pauseAfterMs: j1 },
    { text: "Je regarde.", pauseAfterMs: j2 },
  ];
}
