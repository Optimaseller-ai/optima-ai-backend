import "server-only";

/**
 * Upsell : angles « gamme » (sans halluciner SKU).
 */
export type UpsellFramingSnapshot = {
  suggestTierStepUp: boolean;
  justifyWith: "comfort" | "durability" | "service_margin" | "stock_mix";
};

export function inferUpsellFraming(message: string): UpsellFramingSnapshot {
  const m = String(message ?? "").toLowerCase();
  const tier = /\b(upgrade|premium|pro|sup[eé]rieur|gamme\s+sup|meilleure\s+mati[eè]re)\b/i.test(m);

  let justifyWith: UpsellFramingSnapshot["justifyWith"] = "comfort";
  if (/\b(casse|dur|solide|daily|quotidien|travail\s+terrain)\b/i.test(m)) justifyWith = "durability";
  if (/\b(sav|retour|\bfacture|\bfacteur)\b/i.test(m)) justifyWith = "service_margin";
  if (/\b(il\s+reste|stock|couleur)\b/i.test(m)) justifyWith = "stock_mix";

  return { suggestTierStepUp: tier, justifyWith };
}
