import type { DominantEmotion, ProspectEmotionalState } from "./types";

const GENERIC_BANNED = [
  "Je comprends votre déception",
  "Votre satisfaction est notre priorité",
  "Je suis là pour vous aider",
  "N'hésitez pas",
  "En tant qu'assistant",
  "How may I assist",
];

export type EmpatheticHints = {
  guidanceFr: string[];
  guidanceEn: string[];
  exampleShapesFr: string[];
  exampleShapesEn: string[];
  antiRoboticRules: string[];
};

/** Consignes et formes de réponses empathiques — pas de copier-coller robot. */
export function buildEmpatheticResponseHints(state: ProspectEmotionalState, lang: "fr" | "en" | "es"): EmpatheticHints {
  const antiRoboticRules = [
    ...GENERIC_BANNED.map((p) => `Interdit : « ${p} »`),
    lang === "en"
      ? "No cold one-liners; no stacked corporate apologies."
      : "Pas de réponse froide ; pas d’excuses corporate en rafale.",
    lang === "en"
      ? "Vary empathy — do not repeat the same reassurance twice in a row."
      : "Varier l’empathie — ne pas répéter la même reassurance deux fois de suite.",
  ];

  const guidanceFr: string[] = [];
  const guidanceEn: string[] = [];
  const exampleShapesFr: string[] = [];
  const exampleShapesEn: string[] = [];

  if (state.dominantEmotion === "scam_fear" || state.trustLevel < 0.4) {
    guidanceFr.push("Peur arnaque : transparence + geste vérifiable (contrôle avant envoi, suivi).");
    exampleShapesFr.push(
      "Je comprends votre inquiétude — c’est normal de demander.",
      "Je préfère que vous soyez totalement rassuré avant de continuer.",
    );
    guidanceEn.push("Scam fear: transparency + verifiable step before shipping.");
    exampleShapesEn.push("I get why you’d ask — totally fair.", "I’d rather you feel sure before we move on.");
  }

  if (state.frustrationLevel >= 0.5) {
    guidanceFr.push("Frustration : calmer, une action concrète, zéro pitch.");
    exampleShapesFr.push("Je vais vous aider calmement sur ce point.", "On reprend tranquillement — dites-moi ce qui bloque.");
    guidanceEn.push("Frustration: calm tone, one concrete step, zero pitch.");
    exampleShapesEn.push("I’ll help you calmly on this.", "Let’s take it step by step — what’s blocking you?");
  }

  if (state.dominantEmotion === "hesitation" || state.dominantEmotion === "confusion") {
    guidanceFr.push("Hésitation / confusion : simplifier, une info à la fois.");
    exampleShapesFr.push("Pas de rush — je vous explique simplement.", "On peut avancer à votre rythme.");
    guidanceEn.push("Hesitation: simplify, one fact at a time.");
    exampleShapesEn.push("No rush — I’ll keep it simple.", "We can go at your pace.");
  }

  if (state.dominantEmotion === "enthusiasm" || state.dominantEmotion === "excitement") {
    guidanceFr.push("Enthousiasme : suivre l’énergie sans sur-vendre.");
    exampleShapesFr.push("Top — on fait ça proprement pour vous.", "Parfait, je vous guide sur la suite.");
    guidanceEn.push("Enthusiasm: match energy without overselling.");
    exampleShapesEn.push("Great — let’s do this cleanly for you.", "Perfect, I’ll walk you through the next step.");
  }

  if (state.dominantEmotion === "purchase_stress" || state.dominantEmotion === "emotional_urgency") {
    guidanceFr.push("Stress achat : rassurer sur délais et étapes claires.");
    exampleShapesFr.push("Je vous accompagne étape par étape — pas de mauvaise surprise.");
    guidanceEn.push("Purchase stress: clear steps and realistic timing.");
    exampleShapesEn.push("I’ll walk you through each step — no surprises.");
  }

  if (!guidanceFr.length) {
    guidanceFr.push("Ton chaleureux naturel — employé boutique, pas assistant.");
    guidanceEn.push("Warm natural tone — shop employee, not assistant.");
  }

  return { guidanceFr, guidanceEn, exampleShapesFr, exampleShapesEn, antiRoboticRules };
}
