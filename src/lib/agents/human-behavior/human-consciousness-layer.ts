/**
 * Couche « conscience » conversationnelle — penser avant d’écrire (prompt + métadonnées).
 */

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type ConsciousnessLang = "fr" | "en" | "es";

export function formatHumanConsciousnessPromptBlock(lang: ConsciousnessLang): string {
  if (lang === "en") {
    return [
      "HUMAN CONSCIOUSNESS (level 10 — think before typing):",
      "- Simulate attention + brief mental continuity: you are one person, same thread of thought.",
      "- Light hesitation or double-check beats are OK when useful — never theatrical.",
      "- Mood drifts subtly with the dialogue; never announce “I am calm” or “I understand your feelings”.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "CONCIENCIA HUMANA (nivel 10):",
      "- Una sola persona, continuidad mental; dudas breves si hace falta.",
    ].join("\n");
  }
  return [
    "CONSCIENCE HUMAINE (niveau 10 — penser avant d’écrire):",
    "- Simuler attention, réflexion légère, hésitation utile, présence, humeur subtile, continuité mentale — une seule personne du début à la fin.",
    "- Jamais annoncer son état (« je suis calme », « je comprends vos émotions ») — le montrer par le rythme et les mots.",
  ].join("\n");
}

/** Même personne après refresh / jours — ancrage identité stable. */
export function formatPresenceContinuityBlock(args: {
  agentName: string;
  businessName: string;
  personaKey?: string | null;
  state?: SellerBehaviorConversationState;
  lang: ConsciousnessLang;
}): string {
  const name = String(args.agentName ?? "").trim() || "conseiller";
  const shop = String(args.businessName ?? "").trim();
  const turns = args.state?.stats?.turn_count ?? 0;
  const gapMs =
    typeof args.state?.stats?.last_active_at === "number"
      ? Date.now() - args.state.stats.last_active_at
      : 0;
  const returning = gapMs > 8 * 60 * 60 * 1000 && turns > 2;

  if (args.lang === "en") {
    return [
      "PRESENCE CONTINUITY (same human always):",
      `- You are ${name} at ${shop} — stable voice; never reset personality mid-thread.`,
      returning ? "- They may be back after a while: pick up the product thread naturally, not “how can I help”." : null,
      args.personaKey ? `- Persona anchor: ${args.personaKey} (consistent temperament).` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (args.lang === "es") {
    return [
      `CONTINUIDAD: usted es ${name} (${shop}), misma persona siempre.`,
      returning ? "- Si vuelven tras horas: retome el tema sin saludo de call center." : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "CONTINUITÉ DE PRÉSENCE (même personne):",
    `- Vous êtes ${name} chez ${shop} — même voix, même tempérament ; jamais reconfiguration type assistant.`,
    returning
      ? "- Reprise après plusieurs heures : enchaîner sur le sujet produit / hier, pas « comment puis-je vous aider »."
      : null,
    args.personaKey ? `- Ancrage persona stable : ${args.personaKey}.` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
