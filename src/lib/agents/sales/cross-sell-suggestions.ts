/**
 * Suggestions de vente croisée à partir du catalogue texte + centre d’intérêt prospect.
 * Heuristique légère (pas d’appel LLM).
 */

const PHONE_RE = /\b(téléphone|telephone|smartphone|iphone|samsung|android|mobile)\b/i;
const SHOE_RE = /\b(chaussure|basket|sneaker|talons?)\b/i;
const AUDIO_RE = /\b(écouteur|ecouteur|airpod|casque|headphone)\b/i;

export function buildCrossSellSuggestions(args: { userText: string; catalogBlob: string }): string[] {
  const blob = String(args.catalogBlob ?? "");
  const lines = blob
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "));
  const names = lines
    .map((l) => l.replace(/^-\s*/, "").split(/\s{2,}/)[0]?.trim())
    .filter(Boolean);

  const t = String(args.userText ?? "").toLowerCase();
  const out: string[] = [];

  if (PHONE_RE.test(t) || names.some((n) => PHONE_RE.test(n))) {
    const accessory = names.find((n) => AUDIO_RE.test(n) && !PHONE_RE.test(n));
    if (accessory) out.push(`Accessoire lié possible: ${accessory.split(",")[0]?.trim() ?? accessory}.`);
    else out.push("Si le prospect fixe un téléphone, proposer naturellement un accessoire audio ou protection seulement si au catalogue.");
  }
  if (SHOE_RE.test(t)) {
    out.push("Pour chaussures: proposer une seconde option « modèle similaire » ou « gamme au-dessus » si le catalogue le permet, sans insister.");
  }

  const alt = names.find((n) => !t.includes(n.slice(0, 12).toLowerCase()) && n.length > 4);
  if (alt && out.length < 2) out.push(`Alternative catalogue: ${alt.split(",")[0]?.trim() ?? alt}.`);

  return out.slice(0, 3);
}
