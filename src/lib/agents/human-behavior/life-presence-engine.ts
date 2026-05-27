/**
 * Présence « vie » — l’employé semble exister en dehors du fil (rare, crédible).
 */

export type LifePresenceLang = "fr" | "en" | "es";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

const LIFE_FR = [
  "Je viens juste de revenir.",
  "Je terminais une vérification.",
  "Je suis encore au magasin.",
  "Je viens de recevoir les nouveaux cartons.",
  "Je reviens vers vous.",
  "Je viens de finir une vérification.",
  "Le magasin est un peu chargé aujourd’hui.",
  "Je viens d’avoir le retour du stock.",
];

const LIFE_EN = [
  "I just got back to my desk.",
  "I was finishing a stock check.",
  "Still at the store.",
  "We just got new cartons in.",
  "Back with you now.",
  "Just finished a stock check.",
  "Store’s a bit busy today.",
  "Stock update just came in.",
];

const LIFE_ES = [
  "Acabo de volver.",
  "Estaba terminando una verificación.",
  "Sigo en la tienda.",
  "Acaban de llegar cajas nuevas.",
  "Ya estoy de vuelta.",
  "Acabo de terminar una verificación.",
  "La tienda está un poco cargada hoy.",
  "Acaba de llegar la actualización de stock.",
];

/** ~1 sur 12 : micro-présence « vie hors chat » (client interlude). */
export function pickLifePresenceMicroLine(lang: LifePresenceLang, seed: string): string | null {
  const h = seedHash(seed + "life");
  if (h % 12 !== 0) return null;
  const pool = lang === "en" ? LIFE_EN : lang === "es" ? LIFE_ES : LIFE_FR;
  return pool[h % pool.length] ?? null;
}

export function formatLifePresencePromptBlock(lang: LifePresenceLang): string {
  if (lang === "en") {
    return [
      "LIFE PRESENCE (rare, believable):",
      "- Occasionally imply you exist beyond this chat (just back from stock check, still at store, new delivery) — never stacked, never dramatic.",
      "- Subconscious effect: they feel a real person at work, not a bot waiting in a void.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "PRESENCIA VIDA (raro):",
      "- A veces ancle que está en la tienda / acaba de verificar stock — con moderación.",
    ].join("\n");
  }
  return [
    "PRÉSENCE VIE (rare, crédible):",
    "- Parfois suggérer une activité réelle hors fil (« je viens de revenir », « je terminais une vérif », « encore au magasin », « nouveaux cartons ») — avec parcimonie, jamais en rafale.",
    "- Effet : le prospect sent une personne qui travaille, pas une IA en attente.",
  ].join("\n");
}
