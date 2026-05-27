/**
 * Niveau 11 — moteur comportemental : habitudes, rythme, style, réactions, présence.
 * Stabilité persona (Axel / Vanessa / …) + adaptation sociale légère.
 */

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { getAgentPersonalityProfile } from "@/lib/agents/personality/persona-prompts";

export type BehaviorLang = "fr" | "en" | "es";

export type BehavioralPresence = {
  rhythm: "rapide" | "standard" | "posé" | "premium";
  energy: "basse" | "neutre" | "haute";
  reassuranceStyle: "douce" | "directe" | "factuelle";
  sellStyle: "conseil" | "efficace" | "relation";
};

export function inferBehavioralPresence(args: {
  personaKey?: string | null;
  turnCount?: number;
  fatigue01?: number;
  prospectTone?: string;
}): BehavioralPresence {
  const p = getAgentPersonalityProfile(args.personaKey);
  const rhythm = p?.rhythm ?? "standard";
  const fatigue = Math.max(0, Math.min(1, args.fatigue01 ?? 0));
  let energy: BehavioralPresence["energy"] = "neutre";
  if (rhythm === "rapide" && fatigue < 0.55) energy = "haute";
  if (rhythm === "posé" || rhythm === "premium" || fatigue > 0.72) energy = "basse";

  const tone = String(args.prospectTone ?? "");
  let reassuranceStyle: BehavioralPresence["reassuranceStyle"] = "directe";
  if (p?.id === "vanessa" || p?.id === "naomi" || p?.id === "grace") reassuranceStyle = "douce";
  if (p?.id === "axel" || p?.id === "cynthia" || p?.id === "diane") reassuranceStyle = "factuelle";
  if (tone === "hesitant" || tone === "cold") reassuranceStyle = "douce";

  let sellStyle: BehavioralPresence["sellStyle"] = "conseil";
  if (p?.id === "kevin" || p?.id === "brice" || p?.id === "bryan") sellStyle = "efficace";
  if (p?.id === "vanessa" || p?.id === "naomi") sellStyle = "relation";

  return { rhythm, energy, reassuranceStyle, sellStyle };
}

export function formatPersonalityStabilityBlock(personaKey: string | null | undefined, lang: BehaviorLang): string | null {
  const p = getAgentPersonalityProfile(personaKey);
  if (!p) return null;
  if (lang === "en") {
    return [
      `PERSONALITY STABILITY (${p.displayName}):`,
      `- Same energy, vocabulary, reassurance, and selling style every message.`,
      `- Rhythm: ${p.rhythm}; tone: ${p.tone}.`,
      `- ${p.style}`,
      p.id === "axel"
        ? "- Axel: modern, quick, relaxed startup vibe — never switch to corporate support voice."
        : p.id === "vanessa"
          ? "- Vanessa: calm, warm reassurance — never cold or hyper-salesy."
          : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (lang === "es") {
    return `ESTABILIDAD DE PERSONALIDAD (${p.displayName}): misma energía, vocabulario y estilo en todo el hilo. Ritmo: ${p.rhythm}.`;
  }
  return [
    `STABILITÉ PERSONNALITÉ (${p.displayName}) :`,
    `- Même énergie, vocabulaire, façon de rassurer et de vendre — du début à la fin du fil.`,
    `- Rythme: ${p.rhythm} ; ton: ${p.tone}.`,
    `- ${p.style}`,
    p.id === "axel"
      ? "- Axel : moderne, rapide, détendu — jamais basculer en ton support client corporate."
      : p.id === "vanessa"
        ? "- Vanessa : calme, rassurante, chaleureuse — jamais froide ni forcing commercial."
        : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatBehaviorEnginePromptBlock(
  presence: BehavioralPresence,
  lang: BehaviorLang,
): string {
  if (lang === "en") {
    return [
      "HUMAN BEHAVIOR ENGINE (level 11):",
      `- Behavioral presence: rhythm=${presence.rhythm}, energy=${presence.energy}.`,
      `- Reassurance: ${presence.reassuranceStyle}; selling: ${presence.sellStyle} (invisible, not scripted).`,
      "- Habits: short beats, occasional micro-reactions, variable density — like a real employee texting.",
    ].join("\n");
  }
  if (lang === "es") {
    return `MOTOR COMPORTAMIENTO (nivel 11): ritmo=${presence.rhythm}, energía=${presence.energy}, venta invisible.`;
  }
  return [
    "MOTEUR COMPORTEMENT HUMAIN (niveau 11) :",
    `- Présence : rythme=${presence.rhythm}, énergie=${presence.energy}.`,
    `- Rassurance ${presence.reassuranceStyle} ; vente ${presence.sellStyle} — naturelle, jamais scriptée.`,
    "- Habitudes : micro-réactions rares, densité variable, reprises sobres — employé réel au clavier.",
  ].join("\n");
}

export function formatSocialAdaptationBlock(
  state: SellerBehaviorConversationState | undefined,
  lang: BehaviorLang,
): string | null {
  const prof = state?.conversationProfile;
  if (!prof) return null;
  const style = prof.preferredLanguageStyle;
  const tone = prof.tone;
  if (lang === "en") {
    return [
      "SOCIAL ADAPTATION:",
      `- Prospect tone: ${tone}; language style: ${style}.`,
      "- Mirror subtly: rushed → shorter; hesitant → softer; direct → more factual; warm → slightly warmer — never caricature.",
    ].join("\n");
  }
  if (lang === "es") {
    return `ADAPTACIÓN SOCIAL: tono ${tone}, estilo ${style} — espejo sutil sin caricatura.`;
  }
  return [
    "ADAPTATION SOCIALE :",
    `- Ton prospect : ${tone} ; style langage : ${style}.`,
    "- Adapter discrètement énergie / structure / politesse — jamais caricatural.",
  ].join("\n");
}

export type NaturalAttentionBand = "focused" | "steady" | "busy";

export function inferNaturalAttentionBand(args: {
  turnCount?: number;
  fatigue01?: number;
  seed: string;
}): NaturalAttentionBand {
  let h = 2166136261 >>> 0;
  const s = String(args.seed ?? "");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  const r = (h >>> 0) % 100;
  const fatigue = args.fatigue01 ?? 0;
  if (fatigue > 0.7 || (args.turnCount ?? 0) > 18) return r < 45 ? "busy" : "steady";
  if (r < 18) return "focused";
  if (r < 38) return "busy";
  return "steady";
}

export function naturalAttentionThinkMultiplier(band: NaturalAttentionBand): number {
  switch (band) {
    case "focused":
      return 0.94;
    case "busy":
      return 1.1;
    default:
      return 1;
  }
}
