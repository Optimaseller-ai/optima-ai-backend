import { detectSalesObjections, type ObjectionHit, type ObjectionKind } from "@/lib/agents/sales-intelligence/objections/objection-detector";
import type { ObjectionType } from "@/lib/ai/sales/types";

export type BrainObjectionHit = {
  type: ObjectionType;
  weight: number;
  snippet?: string;
};

function kindToObjectionType(kind: ObjectionKind): ObjectionType {
  switch (kind) {
    case "price":
      return "PRICE";
    case "delivery":
      return "DELIVERY";
    case "trust":
      return "TRUST";
    case "competitor_compare":
      return "COMPETITION";
    case "quality":
      return "QUALITY";
    default:
      return "NONE";
  }
}

function memoryObjectionToType(snippet: string): ObjectionType | null {
  const s = snippet.toLowerCase();
  if (/\b(prix|cher|budget)\b/i.test(s)) return "PRICE";
  if (/\b(livraison|transport|colis)\b/i.test(s)) return "DELIVERY";
  if (/\b(confiance|arnaque|avis)\b/i.test(s)) return "TRUST";
  if (/\b(concurrent|amazon|jumia|vs)\b/i.test(s)) return "COMPETITION";
  if (/\b(qualit|faux|copie)\b/i.test(s)) return "QUALITY";
  return null;
}

function mergeHits(live: ObjectionHit[], memory?: string[]): BrainObjectionHit[] {
  const out: BrainObjectionHit[] = live
    .map((h) => ({
      type: kindToObjectionType(h.kind),
      weight: h.weight,
      snippet: h.snippet,
    }))
    .filter((h) => h.type !== "NONE");

  for (const mem of memory ?? []) {
    const t = memoryObjectionToType(mem);
    if (!t || out.some((o) => o.type === t)) continue;
    out.push({ type: t, weight: 0.55, snippet: mem.slice(0, 72) });
  }

  out.sort((a, b) => b.weight - a.weight);
  return out.slice(0, 3);
}

/** Détecte prix, livraison, confiance, concurrence, qualité. */
export function detectBrainObjections(message: string, memoryObjections?: string[]): BrainObjectionHit[] {
  const live = detectSalesObjections(message);
  return mergeHits(live, memoryObjections);
}

export function primaryBrainObjection(hits: BrainObjectionHit[]): ObjectionType {
  return hits[0]?.type ?? "NONE";
}
