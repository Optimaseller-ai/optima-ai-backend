import type { LearningMemory, ProductPerformance } from "../memory/learning-memory-types";

export type ProductMentionObservation = {
  productName: string;
  at: string;
  converted?: boolean;
  ignored?: boolean;
};

function normProduct(name: string): string {
  return String(name ?? "").trim().slice(0, 80);
}

export function applyProductObservations(
  memory: LearningMemory,
  observations: ProductMentionObservation[],
): LearningMemory {
  const map = new Map<string, ProductPerformance>();
  for (const p of memory.bestProducts) {
    map.set(p.name.toLowerCase(), { ...p });
  }

  for (const o of observations) {
    const name = normProduct(o.productName);
    if (!name || name.length < 2) continue;
    const key = name.toLowerCase();
    const cur = map.get(key) ?? {
      name,
      mentions: 0,
      conversions: 0,
      interestScore: 0,
    };
    cur.mentions += 1;
    if (o.converted) cur.conversions += 1;
    if (o.ignored) cur.interestScore = Math.max(0, cur.interestScore - 5);
    else cur.interestScore = Math.min(100, cur.interestScore + 8);
    if (o.converted) cur.interestScore = Math.min(100, cur.interestScore + 15);
    map.set(key, cur);
  }

  const bestProducts = [...map.values()]
    .sort((a, b) => b.interestScore - a.interestScore || b.conversions - a.conversions)
    .slice(0, 20);

  return { ...memory, bestProducts, updatedAt: new Date().toISOString() };
}

/** Extrait des noms produits depuis texte + état conversation. */
export function extractProductMentions(args: {
  text: string;
  preferredProducts?: string[];
  viewedProducts?: string[];
}): string[] {
  const out = new Set<string>();
  for (const p of [...(args.preferredProducts ?? []), ...(args.viewedProducts ?? [])]) {
    const t = String(p).trim();
    if (t.length >= 2) out.add(t);
  }
  const quoted = String(args.text ?? "").match(/«\s*([^»]{2,60})\s*»/g);
  if (quoted) {
    for (const q of quoted) {
      const inner = q.replace(/[«»]/g, "").trim();
      if (inner.length >= 2) out.add(inner);
    }
  }
  return [...out].slice(0, 6);
}
