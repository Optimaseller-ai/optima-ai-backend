import "server-only";

import type { ConversationProfile } from "@/lib/agents/memory/conversation-state";
import type { SalesSignalsMemory } from "@/lib/agents/memory/conversation-state";
import type { BuyingIntentSnapshot } from "../intent-analysis/buying-intent-engine";
import type { ObjectionHit } from "../objections/objection-detector";

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function uniqKinds(kinds: string[], max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of kinds) {
    const t = k.trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Persiste mémoire signaux vente (serveur — tour prospect).
 */
export function mergeSalesSignalsMemory(args: {
  prev?: SalesSignalsMemory;
  buying: BuyingIntentSnapshot;
  objections: ObjectionHit[];
  conversationProfile: ConversationProfile | undefined;
  userMessageChars: number;
  activeHourLocal?: number;
  /** Ex. montant FCFA depuis productMemory — plus fiable que lastTopics. */
  budgetHint?: string;
}): SalesSignalsMemory {
  const prev = args.prev ?? {};
  let trustLevel01 = clamp01(typeof prev.trustLevel01 === "number" ? prev.trustLevel01 : 0.52);

  for (const o of args.objections) {
    if (o.kind === "trust") trustLevel01 = clamp01(trustLevel01 - 0.09 * o.weight);
    if (o.kind === "quality" || o.kind === "delivery") trustLevel01 = clamp01(trustLevel01 - 0.045 * o.weight);
  }

  if (args.buying.phase === "imminent_purchase") trustLevel01 = clamp01(trustLevel01 + 0.05);
  if (args.buying.phase === "purchase_intent") trustLevel01 = clamp01(trustLevel01 + 0.03);

  const prevKinds = Array.isArray(prev.objectionKinds) ? prev.objectionKinds.map(String) : [];
  const nextKinds = uniqKinds([...args.objections.map((x) => x.kind), ...prevKinds], 14);

  const budgetSnippet = typeof args.budgetHint === "string" ? args.budgetHint.trim() : "";
  const budgetEcho = uniqKinds(
    [...(Array.isArray(prev.budgetEcho) ? prev.budgetEcho : []), ...(budgetSnippet ? [budgetSnippet.slice(0, 48)] : [])],
    8,
  );

  const pref = args.conversationProfile?.preferredProducts ?? [];
  const preferredEcho = uniqKinds(
    [...(Array.isArray(prev.preferredEcho) ? prev.preferredEcho : []), ...pref.map((x) => String(x).slice(0, 60))],
    12,
  );

  return {
    lastBuyingPhase: args.buying.phase,
    lastIntentScore: args.buying.intentScore,
    objectionKinds: nextKinds.length ? nextKinds : undefined,
    trustLevel01,
    lastUserChars: args.userMessageChars,
    activeLocalHour:
      typeof args.activeHourLocal === "number" ? Math.round(args.activeHourLocal) % 24 : prev.activeLocalHour,
    budgetEcho: budgetEcho.length ? budgetEcho : undefined,
    preferredEcho: preferredEcho.length ? preferredEcho : undefined,
    lastUpdatedAt: Date.now(),
  };
}
