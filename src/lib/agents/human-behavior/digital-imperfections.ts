import "server-only";

/**
 * Imperfections numériques subtiles — post-traitement serveur.
 */

export function applyDigitalImperfections(text: string, seed: string): string {
  let out = String(text ?? "").trim();
  if (!out || out.length < 40) return out;

  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const r = (h >>> 0) % 100;

  if (r < 6 && out.length > 120) {
    const parts = out.split(/(?<=[.!?…])\s+/).filter(Boolean);
    if (parts.length > 2) out = parts.slice(0, 2).join(" ").trim();
  }

  if (r >= 6 && r < 10 && !/^Donc|^En fait|^So /i.test(out)) {
    if (/\b(fr|oui|d'accord)\b/i.test(out.slice(0, 20))) {
      out = out.replace(/^(Oui\.?\s+|D'accord\.?\s+)/i, "$1Donc ");
    }
  }

  return out.replace(/\s{2,}/g, " ").trim();
}

export function formatDigitalImperfectionsPromptBlock(lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return "DIGITAL IMPERFECTIONS: occasional shorter reply or natural restart — never sloppy.";
  }
  if (lang === "es") {
    return "IMPERFECCIONES DIGITALES: a veces más corto o reprise natural — sin descuido.";
  }
  return "IMPERFECTIONS NUMÉRIQUES : parfois plus court, mini hésitation ou reprise (« Donc… ») — jamais bâclé.";
}
