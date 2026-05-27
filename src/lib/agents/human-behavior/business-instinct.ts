import type { ProspectTone } from "@/lib/agents/memory/conversation-state";
import { analyzeSocialIntelligence } from "@/lib/agents/human-behavior/social-intelligence-engine";

export function formatBusinessInstinctPromptBlock(args: {
  prospectTone?: ProspectTone;
  message: string;
  lang: "fr" | "en" | "es";
}): string {
  const intel = analyzeSocialIntelligence(args.message);
  const tone = args.prospectTone ?? "neutral";
  let mode = "balanced";
  if (tone === "rushed" || tone === "aggressive" || intel.cues.includes("implicit_refusal")) mode = "efficient";
  else if (tone === "hesitant" || intel.cues.includes("hidden_hesitation")) mode = "reassuring";
  else if (tone === "curious" || intel.cues.includes("implicit_interest")) mode = "informative";

  if (args.lang === "en") {
    const m: Record<string, string> = {
      efficient: "BUSINESS INSTINCT: pressed — be direct, facts first, no fluff or urgency tricks.",
      reassuring: "BUSINESS INSTINCT: hesitant — calm, patient, soft proof; invisible sale.",
      informative: "BUSINESS INSTINCT: curious — a bit more detail, still WhatsApp-short.",
      balanced: "BUSINESS INSTINCT: balanced shop advisor — advise, don’t push.",
    };
    return m[mode] ?? m.balanced;
  }
  if (args.lang === "es") {
    return `INSTINTO COMERCIAL (${mode}): vendedor real, no chatbot.`;
  }
  const m: Record<string, string> = {
    efficient: "INSTINCT MÉTIER : pressé — efficace, fait d’abord, zéro forcing.",
    reassuring: "INSTINCT MÉTIER : hésitant — rassurer sans « soyez rassuré », vente invisible.",
    informative: "INSTINCT MÉTIER : curieux — un peu plus de détail, toujours court.",
    balanced: "INSTINCT MÉTIER : conseiller boutique — guider, pas pousser.",
  };
  return m[mode] ?? m.balanced;
}
