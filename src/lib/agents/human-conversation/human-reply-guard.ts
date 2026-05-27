import type { IntentPriority } from "./types";
import { isCriticalBuyingPriority } from "./intent-priority-engine";

const HOLD_PATTERNS_FR = [
  /\bje\s+vérifie\.?\b/gi,
  /\bje\s+verifie\.?\b/gi,
  /\bje\s+regarde\s+cela\b/gi,
  /\bje\s+regarde\s+ça\b/gi,
  /\bun\s+instant\b/gi,
  /\battendez\b/gi,
  /\bdeux\s+minutes\b/gi,
];

const HOLD_PATTERNS_EN = [
  /\blet\s+me\s+check\b/gi,
  /\bone\s+moment\b/gi,
  /\bjust\s+a\s+(sec|second)\b/gi,
  /\bi['']?ll\s+check\b/gi,
];

const REPLACEMENT_FR_CRITICAL = [
  "Je vous envoie ça tout de suite.",
  "Voici ce qu’on peut faire maintenant.",
  "On valide ensemble — vous préférez quelle option ?",
];

const REPLACEMENT_EN_CRITICAL = [
  "Sending that to you now.",
  "Here’s what we can do right away.",
  "Let’s lock it in — which option works?",
];

function pickReplacement(lang: "fr" | "en" | "es", seed: string): string {
  const pool = lang === "en" ? REPLACEMENT_EN_CRITICAL : REPLACEMENT_FR_CRITICAL;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length]!;
}

/** Supprime formulations « assistant » et hold interdits quand signal d’achat fort. */
export function enforceHumanConversationReply(args: {
  text: string;
  intentPriority: IntentPriority;
  lang?: "fr" | "en" | "es";
  recentAssistantMessages?: string[];
  seed?: string;
}): { text: string; strippedHolds: number; replacedHolds: number } {
  let out = String(args.text ?? "").trim();
  if (!out) return { text: "", strippedHolds: 0, replacedHolds: 0 };

  const lang = args.lang ?? "fr";
  const critical = isCriticalBuyingPriority(args.intentPriority) || args.intentPriority === "HIGH";
  const patterns = lang === "en" ? HOLD_PATTERNS_EN : HOLD_PATTERNS_FR;

  let strippedHolds = 0;
  let replacedHolds = 0;

  for (const re of patterns) {
    if (re.test(out)) {
      strippedHolds += 1;
      if (critical) {
        out = out.replace(re, pickReplacement(lang, (args.seed ?? out) + String(strippedHolds)));
        replacedHolds += 1;
      } else {
        out = out.replace(re, "").replace(/\s{2,}/g, " ").trim();
      }
    }
  }

  // Éviter triple hold dans le fil récent
  const recent = args.recentAssistantMessages ?? [];
  const recentHoldCount = recent.filter((m) =>
    HOLD_PATTERNS_FR.some((p) => {
      p.lastIndex = 0;
      return p.test(m);
    }),
  ).length;

  if (recentHoldCount >= 2 && critical) {
    for (const re of patterns) {
      out = out.replace(re, pickReplacement(lang, args.seed ?? "hold"));
      replacedHolds += 1;
    }
  }

  out = out
    .replace(/^(Bonjour|Hello|Hi)[,!.\s]+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!out && critical) {
    out = pickReplacement(lang, args.seed ?? "fallback");
    replacedHolds += 1;
  }

  return { text: out, strippedHolds, replacedHolds };
}

export const FORBIDDEN_HOLD_PHRASES = [
  "Je vérifie.",
  "Je regarde cela Monsieur.",
  "Un instant s'il vous plaît.",
  "Let me check.",
  "One moment sir",
] as const;
