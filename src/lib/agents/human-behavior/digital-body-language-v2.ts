/**
 * Langage corporel numérique v2 — hésitation, réflexion, reprise, respiration, énergie.
 */

export type BodyLangV2Lang = "fr" | "en" | "es";

export function formatDigitalBodyLanguageV2PromptBlock(lang: BodyLangV2Lang): string {
  if (lang === "en") {
    return [
      "DIGITAL BODY LANGUAGE V2:",
      "- Hesitation beats rare (“Hmm.” / “Let me see.”) — never stacked.",
      "- Conversational breathing: short ack → micro pause → substance.",
      "- Energy can dip on long threads; occasional shorter reply = human fatigue, not rudeness.",
    ].join("\n");
  }
  if (lang === "es") {
    return "LENGUAJE CORPORAL DIGITAL V2: micro pausas, respiración conversacional, energía variable.";
  }
  return [
    "LANGAGE CORPOREL NUMÉRIQUE V2 :",
    "- Micro-hésitations rares (« Hmm. » « Attendez. ») — jamais en rafale.",
    "- Respiration : accusé court → pause → fond ; reprises naturelles (« Donc… » « En fait… ») avec parcimonie.",
    "- Énergie qui baisse légèrement sur fil long — humain, pas sec.",
  ].join("\n");
}

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export type HesitationBeat = { text: string; pauseAfterMs: number };

export function shouldInjectHesitationBeat(userMessage: string, seed: string, rushed: boolean): boolean {
  if (rushed) return false;
  const m = String(userMessage ?? "").trim();
  if (m.length < 40) return false;
  if (/\b(prix|stock|livraison|commander|disponible|taille|couleur)\b/i.test(m) && seedHash(seed + "hes") % 100 < 14) {
    return true;
  }
  return m.length > 85 && seedHash(seed + "hes2") % 100 < 10;
}

export function getHesitationBeat(lang: "fr" | "en" | "es", seed: string): HesitationBeat {
  const h = seedHash(seed + "hesbeat") % 3;
  if (lang === "en") {
    const opts = [
      { text: "Hmm.", pauseAfterMs: 520 },
      { text: "Let me see.", pauseAfterMs: 680 },
      { text: "One sec.", pauseAfterMs: 600 },
    ];
    return opts[h] ?? opts[0];
  }
  if (lang === "es") {
    const opts = [
      { text: "Hmm.", pauseAfterMs: 520 },
      { text: "A ver.", pauseAfterMs: 650 },
      { text: "Un momento.", pauseAfterMs: 600 },
    ];
    return opts[h] ?? opts[0];
  }
  const opts = [
    { text: "Hmm.", pauseAfterMs: 520 },
    { text: "Attendez.", pauseAfterMs: 650 },
    { text: "Je vois.", pauseAfterMs: 580 },
  ];
  return opts[h] ?? opts[0];
}

export function digitalBodyLanguageV2ThinkMultiplier(fatigue01: number, energy: "basse" | "neutre" | "haute"): number {
  const f = Math.max(0, Math.min(1, fatigue01));
  let m = 1 + 0.12 * f;
  if (energy === "basse") m *= 1.06;
  if (energy === "haute") m *= 0.97;
  return m;
}

export function digitalBodyLanguageV2ReadBoost(fatigue01: number): number {
  return 1 + 0.1 * Math.max(0, Math.min(1, fatigue01));
}
