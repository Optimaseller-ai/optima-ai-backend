import "server-only";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

/** Micro-imperfection très rare (crédibilité), sans casser le sens. */
export function maybeHumanMicroPrefix(reply: string, seed: string): string {
  if (reply.length < 12 || reply.length > 360) return reply;
  if ((seedHash(seed + reply) >>> 0) % 52 !== 0) return reply;
  if (!/\b(monsieur|madame)\b/i.test(reply)) return reply;
  const prefixes = ["Oui pardon Monsieur. ", "Pardon Monsieur. ", "Oui Madame, pardon. "];
  return prefixes[(seedHash(seed) >>> 0) % prefixes.length] + reply;
}

/**
 * Micro-réaction humaine en tête (rare — pas à chaque message).
 * Langue alignée sur le tour prospect.
 */
export function maybeMicroHumanLead(reply: string, seed: string, lang: "fr" | "en" | "es"): string {
  const raw = String(reply ?? "").trim();
  if (raw.length < 16 || raw.length > 420) return raw;
  const h = seedHash(seed + raw) >>> 0;
  if (h % 19 !== 0) return raw;
  if (/^(je vois|hmm|ah |right\.|i see|vale\.|de acuerdo)/i.test(raw)) return raw;

  const fr = ["Je vois. ", "Ah d’accord. ", "Hmm. ", "Oui. ", "Un instant. "];
  const en = ["I see. ", "Right. ", "Okay. ", "Hmm. ", "One sec. "];
  const es = ["Vale. ", "Ya veo. ", "Mm. ", "Claro. ", "Un momento. "];
  const pack = lang === "en" ? en : lang === "es" ? es : fr;
  const lead = pack[h % pack.length]!;
  const head = raw.slice(0, Math.min(24, raw.length)).toLowerCase();
  if (head.includes(lead.trim().toLowerCase().replace(/\.$/, ""))) return raw;
  return lead + raw.replace(/^[^\p{L}\p{N}]+/u, "");
}
