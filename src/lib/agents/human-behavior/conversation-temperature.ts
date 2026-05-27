/**
 * « Température » conversationnelle agrégée — longueur, rythme, ton (ressenti social).
 */

import { inferConversationEmotionalTemperature } from "@/lib/agents/human-behavior/emotions/conversation-emotion";
import { detectSocialTension } from "@/lib/agents/human-behavior/social-tension-detector";

export type ConversationTemperatureLevel =
  | "froid"
  | "neutre"
  | "ouvert"
  | "engage"
  | "confiance"
  | "tension"
  | "fatigue";

export function inferConversationTemperatureLevel(args: {
  message: string;
  fatigue01?: number;
  /** 2–3 derniers tours utilisateur (texte brut) */
  recentUserMessages?: string[];
  /** Style langage prospect si connu */
  preferredLanguageStyle?: "formal" | "neutral" | "warm";
}): ConversationTemperatureLevel {
  const msg = String(args.message ?? "").trim();
  const fatigue = Math.max(0, Math.min(1, args.fatigue01 ?? 0));
  if (fatigue >= 0.62) return "fatigue";

  const temp = inferConversationEmotionalTemperature(msg);
  const tension = detectSocialTension(msg);
  if (temp === "irrité" || temp === "frustré" || tension !== "none") return "tension";
  if (temp === "froid") return "froid";

  const recent = args.recentUserMessages ?? [];
  if (recent.length >= 2 && recent.every((m) => m.trim().length > 0 && m.trim().length < 18) && msg.length < 22) {
    return "froid";
  }

  if (temp === "prêt_achat") return "confiance";
  if (temp === "chaleureux") return "engage";
  if (temp === "intéressé" || temp === "hésitant") return "ouvert";

  if (args.preferredLanguageStyle === "warm") return "ouvert";
  if (args.preferredLanguageStyle === "formal") return "neutre";

  return "neutre";
}

export function formatConversationTemperaturePromptBlock(
  level: ConversationTemperatureLevel,
  lang: "fr" | "en" | "es",
): string {
  if (lang === "en") {
    const m: Record<ConversationTemperatureLevel, string> = {
      froid: "CONVERSATION TEMP: cold — mirror brevity; no cheer stacking; calm spacing.",
      neutre: "CONVERSATION TEMP: neutral — steady human shop tone.",
      ouvert: "CONVERSATION TEMP: open — clear, welcoming, still not salesy.",
      engage: "CONVERSATION TEMP: engaged — warm but professional; match their energy lightly.",
      confiance: "CONVERSATION TEMP: trust leaning — concise next steps; no pressure tricks.",
      tension: "CONVERSATION TEMP: tension — slower, shorter, de-escalate; no irony back; no ChatGPT empathy.",
      fatigue: "CONVERSATION TEMP: long thread fatigue — slightly shorter messages, same care.",
    };
    return m[level];
  }
  if (lang === "es") {
    const m: Record<ConversationTemperatureLevel, string> = {
      froid: "TEMP: frío — brevedad espejo.",
      neutre: "TEMP: neutro — tono estable.",
      ouvert: "TEMP: abierto — claro y natural.",
      engage: "TEMP: comprometido — calidez ligera.",
      confiance: "TEMP: confianza — pasos claros sin presión.",
      tension: "TEMP: tensión — corto, calmo, sin ironía devuelta.",
      fatigue: "TEMP: fatiga hilo — algo más breve.",
    };
    return m[level];
  }
  const m: Record<ConversationTemperatureLevel, string> = {
    froid: "TEMPÉRATURE CONVERSATION : froid — miroiter la brièveté ; pas d’empilement de politesse ; aération.",
    neutre: "TEMPÉRATURE : neutre — ton boutique stable, humain.",
    ouvert: "TEMPÉRATURE : ouvert — clair, accueillant, sans forcing commercial.",
    engage: "TEMPÉRATURE : engagé — chaleur légère, pro ; suivre un peu leur énergie.",
    confiance: "TEMPÉRATURE : confiance — prochaine étape simple, sans artifice d’urgence.",
    tension: "TEMPÉRATURE : tension — ralentir, raccourcir, désescalader ; pas d’ironie en retour ; pas d’empathie IA.",
    fatigue: "TEMPÉRATURE : fatigue de fil — messages un peu plus courts, même exigence de qualité.",
  };
  return m[level];
}
