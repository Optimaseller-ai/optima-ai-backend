import "server-only";

const OPENERS_FR = ["Oui Monsieur.", "Je vois.", "D’accord.", "Un instant.", "Je regarde.", "Ah oui.", "Effectivement."];
const OPENERS_EN = ["Okay.", "I see.", "Alright.", "One sec.", "Checking.", "Right.", "Fair."];
const OPENERS_ES = ["Vale.", "Lo entiendo.", "De acuerdo.", "Un momento.", "Lo miro.", "Claro.", "Bien."];

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length]!;
}

/** Évite répétitions d’ouverture assistant — variation déterministe sans script fixe. */
export function applyMicroVariationEngine(
  text: string,
  lang: "fr" | "en" | "es",
  microSeed: string,
  recentAssistantLines?: string[],
): string {
  let out = String(text ?? "").trim();
  if (!out) return out;

  const firstLine = out.split(/\n/)[0]!.trim();
  const normStart = firstLine.slice(0, 42).toLowerCase();
  const prev = (recentAssistantLines ?? []).map((x) => String(x ?? "").trim().slice(0, 42).toLowerCase()).filter(Boolean);

  const dup = prev.some((p) => p.length > 8 && (normStart.startsWith(p.slice(0, 14)) || p.startsWith(normStart.slice(0, 14))));
  if (!dup) return out;

  const pool = lang === "en" ? OPENERS_EN : lang === "es" ? OPENERS_ES : OPENERS_FR;
  const alt = pick(pool, `${microSeed}|mv`);
  const low = out.toLowerCase();
  const stem = alt.replace(/\.$/, "").toLowerCase();
  if (low.startsWith(stem)) return out;
  return `${alt} ${out}`.replace(/\s{2,}/g, " ").trim();
}
