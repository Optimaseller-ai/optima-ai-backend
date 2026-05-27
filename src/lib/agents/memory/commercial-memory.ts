import type { CommercialMemory, SellerIntent } from "@/lib/agents/memory/conversation-state";

function uniq(arr: string[], max: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const t = x.trim().slice(0, 120);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Détecte objections courtes à mémoriser pour relances / prochain message. */
export function detectObjectionSnippet(message: string): string | null {
  const m = String(message ?? "").trim();
  if (m.length < 8 || m.length > 200) return null;
  const low = m.toLowerCase();
  if (
    /\b(trop cher|cher|budget|pas confiance|arnaque|livraison|délai|qualité|garantie|hésite|pas sûr|remboursement)\b/i.test(low)
  ) {
    return m.slice(0, 140).replace(/\s+/g, " ");
  }
  return null;
}

export function mergeCommercialMemory(args: {
  prev: CommercialMemory | undefined;
  message: string;
  intent: SellerIntent;
}): CommercialMemory {
  const prev: CommercialMemory = args.prev ?? { likedProducts: [], objections: [], preferences: [] };
  const liked = [...prev.likedProducts];
  const objections = [...prev.objections];
  const preferences = [...(prev.preferences ?? [])];

  const low = args.message.toLowerCase();
  if (/\b(j'aime|j’adore|j adore|intéressé|intéressante|sympa|top|bien|valid|je prends peut)\b/i.test(low) && args.message.length < 160) {
    const hint = args.message.trim().slice(0, 80);
    if (hint) liked.unshift(hint);
  }
  const obj = detectObjectionSnippet(args.message);
  if (obj) objections.unshift(obj);

  if (/\b(pour offrir|pour le sport|pour le travail|pour ma mère|pour un enfant)\b/i.test(low)) {
    preferences.unshift(args.message.trim().slice(0, 100));
  }

  return {
    likedProducts: uniq(liked, 8),
    objections: uniq(objections, 6),
    preferences: uniq(preferences, 6),
    budgetNotes: prev.budgetNotes,
    lastObjectionSnippet: obj ?? prev.lastObjectionSnippet,
  };
}
