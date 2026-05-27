/**
 * Présence « employé réel » — micro-formulations rares (client + prompts).
 * Ne pas sur-utiliser (effet scripted).
 */

export type PresenceUiLang = "fr" | "en" | "es";

function seedHash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

const PRESENCE_FR = [
  "Je viens de vérifier.",
  "Je regarde cela sur le stock.",
  "Je viens d’avoir la confirmation.",
  "Je suis encore au bureau actuellement.",
  "Le livreur est déjà passé aujourd’hui.",
  "Le stock vient d’arriver.",
  "Je suis au magasin actuellement.",
  "La livraison est sortie.",
  "Je viens de vérifier avec l’équipe.",
  "La journée est un peu chargée.",
  "Je réponds entre deux vérifications.",
  "Le stock bouge vite aujourd’hui.",
  "Attendez je revérifie.",
  "Je viens de voir quelque chose.",
  "Oui je me suis trompé sur ce point.",
  "Le fournisseur vient de confirmer.",
  "Le dépôt est presque fermé.",
];

const PRESENCE_EN = [
  "I just double-checked.",
  "I’m looking that up in stock now.",
  "I just got confirmation.",
  "Still at the office right now.",
  "The courier already came by today.",
  "Stock just came in.",
  "I’m at the store right now.",
  "A shipment just went out.",
  "I just checked with the team.",
  "It’s a bit of a busy day.",
  "I’m replying between two stock checks.",
  "Stock’s moving fast today.",
  "Hang on — double-checking.",
  "I just noticed something.",
  "Yeah — I had that bit wrong, fixing it.",
  "Supplier just confirmed.",
  "Warehouse is about to close.",
];

const PRESENCE_ES = [
  "Acabo de verificar.",
  "Lo estoy mirando en el stock.",
  "Acabo de recibir confirmación.",
  "Sigo en la oficina ahora mismo.",
  "El repartidor ya pasó hoy.",
  "Acaba de entrar stock.",
  "Estoy en la tienda ahora mismo.",
  "Salió un envío.",
  "Acabo de confirmar con el equipo.",
  "El día está un poco cargado.",
  "Respondo entre dos comprobaciones.",
  "El stock se mueve rápido hoy.",
  "Un momento, lo reverifico.",
  "Acabo de ver algo.",
  "Sí, me equivoqué ahí.",
  "El proveedor acaba de confirmar.",
  "El depósito está por cerrar.",
];

/**
 * ~1 ligne sur 10 : micro-présence lieu de travail : sinon null (ne rien ajouter).
 */
export function pickPresenceMicroLine(lang: PresenceUiLang, seed: string): string | null {
  const h = seedHash(seed + "presence");
  if (h % 10 !== 0) return null;
  const pool = lang === "en" ? PRESENCE_EN : lang === "es" ? PRESENCE_ES : PRESENCE_FR;
  return pool[h % pool.length] ?? null;
}

/** Bloc prompt serveur — consigne subtile (pas de spam de contexte). */
export function formatPresenceEnginePromptBlock(lang: PresenceUiLang): string {
  if (lang === "en") {
    return [
      "PRESENCE ENGINE (subtle, rare):",
      "- Occasionally anchor in a believable workplace beat (checking stock, at the office, courier) — max once in a while, never stacked.",
      "- Never sound like you’re performing status updates.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "MOTOR DE PRESENCIA (sutil, raro):",
      "- A veces ancle un detalle creíble (stock, oficina, reparto) — con mucha moderación.",
    ].join("\n");
  }
  return [
    "PRÉSENCE MOTEUR (subtil, rare):",
    "- Parfois une micro-ancrage réel (stock, bureau, livreur, confirmation) — avec parcimonie, jamais en rafale.",
    "- Jamais ton « statut d’employé connecté » artificiel.",
  ].join("\n");
}
