import "server-only";

import { normalizeForDedupe } from "@/lib/agents/human-behavior/coherence/duplicate-detector";

const OPENERS_FR = ["Oui.", "D'accord.", "Ok.", "Je vois.", "Compris."];
const OPENERS_EN = ["Sure.", "Ok.", "Got it.", "Right."];

function seedHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/** Évite les ouvertures répétitives vs messages récents. */
export function diversifyResponseOpener(
  text: string,
  recentAssistantMessages: string[] | undefined,
  lang: "fr" | "en" | "es",
  seed: string,
): string {
  let out = String(text ?? "").trim();
  if (!out || out.length > 120) return out;

  const recent = (recentAssistantMessages ?? []).slice(-4).map((m) => normalizeForDedupe(m));
  const openers = lang === "en" ? OPENERS_EN : OPENERS_FR;
  const first = out.split(/(?<=[.!?…])\s+/)[0]?.trim() ?? out;
  const firstNorm = normalizeForDedupe(first);

  const overused = openers.some((o) => recent.filter((r) => r.startsWith(normalizeForDedupe(o))).length >= 2);
  if (!overused) return out;

  const usedSame = recent.some((r) => r.startsWith(firstNorm.slice(0, 12)));
  if (!usedSame) return out;

  const alt = openers[seedHash(seed + out) % openers.length]!;
  if (firstNorm.length < 28) {
    const rest = out.slice(first.length).trim();
    out = rest ? `${alt} ${rest}` : alt;
  }

  return out.trim();
}
