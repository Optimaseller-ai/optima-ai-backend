import "server-only";

export type ObjectionKind =
  | "price"
  | "trust"
  | "delivery"
  | "quality"
  | "thinking_time"
  | "competitor_compare";

export type ObjectionHit = {
  kind: ObjectionKind;
  weight: number;
  snippet?: string;
};

/** Détection multi-objections (soft scores). */
export function detectSalesObjections(message: string): ObjectionHit[] {
  const m = String(message ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!m) return [];

  const hits: ObjectionHit[] = [];

  if (
    /\b(trop\s+cher|prix\s+elev|elev[eé]|remise|rabais|budget|soldes|nego|n[gé]go|discount)\b/i.test(m) ||
    /\b(fcfa|€|\$).*(\b(beaucoup|trop)\b)/i.test(m)
  ) {
    hits.push({ kind: "price", weight: 0.82, snippet: m.slice(0, 72) });
  }

  if (
    /\b(arnaque|scam|je\s+vous\s+connais\s+pas|je\s+t['’]?ai\s+jamais|faire\s+confiance|pourquoi\s+croire|reviews?|avis)\b/i.test(
      m,
    )
  ) {
    hits.push({ kind: "trust", weight: 0.8, snippet: m.slice(0, 72) });
  }

  if (/\b(livraison|livrer|transport|suivi|colis|perdu|cassé|casse|cassee|broken|damaged)\b/i.test(m)) {
    hits.push({ kind: "delivery", weight: 0.72, snippet: m.slice(0, 72) });
  }

  if (/\b(qualité|vrai\s+faux|authentic|copie|réplica|cheap|cheaply|cheap\s+plastic|cheap\s+materiau)\b/i.test(m)) {
    hits.push({ kind: "quality", weight: 0.74, snippet: m.slice(0, 72) });
  }

  if (/\b(r[eé]fl[eé]chi|voir\s+avec|demain|rappeler|pas\s+rush|famille\s+valide)/i.test(m)) {
    hits.push({ kind: "thinking_time", weight: 0.62, snippet: m.slice(0, 72) });
  }

  if (/\b(chez\s+\w+|internet|amazon|jumia|concurrent|autre\s+boutique|vs\.?|versus|lequel\s+est\s+mieux)\b/i.test(m)) {
    hits.push({ kind: "competitor_compare", weight: 0.78, snippet: m.slice(0, 72) });
  }

  hits.sort((a, b) => b.weight - a.weight);
  return hits.slice(0, 3);
}

export function primaryObjection(hits: ObjectionHit[]): ObjectionKind | null {
  return hits[0]?.kind ?? null;
}
