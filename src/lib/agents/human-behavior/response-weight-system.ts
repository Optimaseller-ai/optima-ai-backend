/**
 * Poids émotionnel du message prospect — rythme, longueur de réponse, mémoire.
 * Importable client + serveur (pas server-only).
 */

import type { ConversationEmotionalTemperature } from "@/lib/agents/human-behavior/emotions/conversation-emotion";
import type { ProspectEmotionalMemory, ProspectEmotionalMemoryKind } from "@/lib/agents/memory/conversation-state";

export type ResponseWeightTier = "light" | "medium" | "heavy";

export type ResponseWeightResult = {
  tier: ResponseWeightTier;
  /** Indices debug / prompts */
  tags: string[];
};

function normLower(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * « Poids » du tour : un message lourd (perte, colère, deuil) exige plus de présence — jamais une mini-réponse sèche.
 */
export function computeResponseWeight(message: string): ResponseWeightResult {
  const raw = String(message ?? "").trim();
  const low = normLower(raw);
  const tags: string[] = [];

  if (/\b(perdu|perdre|perdi|lost)\b.*\b(argent|argent|money|dinero|fcfa|cfa|euro|eur|€)\b/i.test(low)) {
    tags.push("financial_loss");
  }
  if (/\b(perdu|perdre)\b.*\b(beaucoup|much|mucho)\b/i.test(low) && /\b(argent|money|dinero|fcfa)\b/i.test(low)) {
    tags.push("financial_loss");
  }
  if (/\b(deces|deuil|mort|malade|hospital|divorc|suicid|depress)\b/i.test(low)) tags.push("life_hardship");
  if (/\b(peur|angoiss|paniqu|desesp|désesp|deprim|triste\s+en\s+ce\s+moment)\b/i.test(low)) tags.push("acute_distress");

  if (tags.some((t) => t === "financial_loss" || t === "life_hardship" || t === "acute_distress")) {
    return { tier: "heavy", tags };
  }

  if (/\b(décu|deception|frustr|injuste|pas\s+juste|arnaque|escroquerie)\b/i.test(low)) tags.push("disappointment");
  if (/\b(triste|mal\s+au|ça\s+me\s+fait\s+du\s+mal|heartbroken)\b/i.test(low)) tags.push("sad");
  if (/\b(fatigu|crevé|creve|épuis|epuis|cansado|no\s+he\s+dormido|tired)\b/i.test(low)) tags.push("tired");

  if (tags.includes("disappointment") || tags.includes("sad")) return { tier: "medium", tags };
  if (tags.includes("tired")) return { tier: "medium", tags };
  if (raw.length >= 220 || raw.split(/\s+/).filter(Boolean).length >= 38) {
    return { tier: "medium", tags: [...tags, "long_form"] };
  }

  return { tier: "light", tags };
}

/** Multiplicateur optionnel pour pauses « réflexion » côté client. */
export function responseWeightThinkBoost(tier: ResponseWeightTier): number {
  if (tier === "heavy") return 1.38;
  if (tier === "medium") return 1.12;
  return 1.0;
}

/** Plancher caractères pour ne pas écraser une réponse trop tôt quand le sujet est lourd (pipeline serveur). */
export function minMessengerCharsForWeight(tier: ResponseWeightTier): number {
  if (tier === "heavy") return 360;
  if (tier === "medium") return 260;
  return 0;
}

export function nextProspectEmotionalMemorySnapshot(args: {
  weight: ResponseWeightResult;
  temperature: ConversationEmotionalTemperature;
  message: string;
  nowMs: number;
}): ProspectEmotionalMemory | null {
  const { weight, temperature, message, nowMs } = args;
  const low = normLower(message);

  if (weight.tier === "heavy") {
    if (weight.tags.includes("financial_loss")) return { kind: "financial_loss", recordedAt: nowMs };
    if (weight.tags.includes("life_hardship") || weight.tags.includes("acute_distress")) {
      return { kind: "sad_or_distress", recordedAt: nowMs };
    }
  }
  if (temperature === "irrité") return { kind: "angry", recordedAt: nowMs };
  if (temperature === "frustré") return { kind: "frustrated", recordedAt: nowMs };
  if (weight.tags.includes("tired") || /\b(fatigu|crevé|creve|épuis|epuis)\b/i.test(low)) {
    return { kind: "tired", recordedAt: nowMs };
  }
  return null;
}

export function decayProspectEmotionalMemory(prev: ProspectEmotionalMemory | undefined, nowMs: number): ProspectEmotionalMemory | undefined {
  if (!prev) return undefined;
  if (nowMs - prev.recordedAt > 72 * 60 * 60 * 1000) return undefined;
  return prev;
}

export function formatResponseWeightPromptBlock(weight: ResponseWeightResult, lang: "fr" | "en" | "es"): string | null {
  if (weight.tier === "light") return null;
  if (lang === "en") {
    return weight.tier === "heavy"
      ? [
          "MESSAGE WEIGHT: HEAVY (personal loss / strong distress).",
          "- Do NOT answer in one dismissive short line. Slow down, acknowledge substance, then help — still WhatsApp-brief overall, but human-serious.",
          "- Forbidden: corporate comfort (“please be reassured”), instant product pivot without recognition.",
        ].join("\n")
      : [
          "MESSAGE WEIGHT: MEDIUM.",
          "- Slightly more room: mirror what they said, then answer — not a generic catalogue opener.",
        ].join("\n");
  }
  if (lang === "es") {
    return weight.tier === "heavy"
      ? [
          "PESO DEL MENSAJE: ALTO (pérdida / malestar fuerte).",
          "- No responda con una línea fría. Reconozca con sobriedad; luego ayude — sin discurso corporativo.",
        ].join("\n")
      : "PESO DEL MENSAJE: MEDIO — un poco más de presencia humana antes del dato.";
  }
  return weight.tier === "heavy"
    ? [
        "POIDS DU MESSAGE : LOURD (perte / sujet sensible).",
        "- Interdit : mini-réponse sèche type standard. Ralentir, reconnaître le fond (sobre), puis avancer utilement — toujours style messagerie, pas roman.",
        "- Interdit : « soyez rassuré », « je comprends votre frustration » type hotline.",
      ].join("\n")
    : [
        "POIDS DU MESSAGE : MOYEN.",
        "- Un peu plus de présence : micro-miroir (« donc plutôt simple et budget serré ») avant le fait utile.",
      ].join("\n");
}

export function mapMemoryKindToPromptHint(kind: ProspectEmotionalMemoryKind, lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    const m: Record<ProspectEmotionalMemoryKind, string> = {
      frustrated: "was frustrated recently",
      sad_or_distress: "was going through a hard moment",
      angry: "was upset/angry recently",
      financial_loss: "mentioned losing money on a purchase",
      tired: "mentioned being tired",
    };
    return m[kind];
  }
  if (lang === "es") {
    const m: Record<ProspectEmotionalMemoryKind, string> = {
      frustrated: "estuvo frustrado recientemente",
      sad_or_distress: "pasó un mal momento",
      angry: "estuvo molesto",
      financial_loss: "mencionó perder dinero",
      tired: "dijo estar cansado",
    };
    return m[kind];
  }
  const m: Record<ProspectEmotionalMemoryKind, string> = {
    frustrated: "était récemment frustré",
    sad_or_distress: "était visiblement mal / tendu",
    angry: "était agacé ou en colère",
    financial_loss: "a évoqué une perte d’argent / déception forte",
    tired: "a dit être fatigué",
  };
  return m[kind];
}
