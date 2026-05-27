import "server-only";

function seedHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/** Micro-imperfections sociales subtiles (reprise, reformulation légère). */
export function maybeApplyHumanImperfectionV2(
  text: string,
  seed: string,
  lang: "fr" | "en" | "es",
): { text: string; applied: boolean } {
  const out = String(text ?? "").trim();
  if (out.length < 55 || out.length > 280) return { text: out, applied: false };

  const roll = seedHash(seed + out) % 100;
  if (roll > 14) return { text: out, applied: false };

  if (lang === "en") {
    if (/\b(that model|this one)\b/i.test(out) && roll < 8) {
      return { text: out.replace(/\b(that model|this one)\b/i, (m) => `Ah — ${m.toLowerCase()}`), applied: true };
    }
    return { text: out, applied: false };
  }

  if (/\b(ce modèle|cette option|celui-là)\b/i.test(out) && roll < 8) {
    return {
      text: out.replace(/\b(ce modèle|cette option|celui-là)\b/i, (m) => `Ah oui — ${m}`),
      applied: true,
    };
  }

  return { text: out, applied: false };
}
