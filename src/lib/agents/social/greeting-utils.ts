/**
 * Utilitaires salutation — sans server-only (importable côté client).
 */

const PERSONAL_Q =
  /\b(tu\s+fais\s+quoi|vous\s+faites\s+quoi|qu['’]?est[- ]ce que tu fais|what\s+are\s+you\s+doing|qué\s+haces)\b/i;

const PRODUCT =
  /\b(prix|stock|dispo|commander|acheter|livraison|modèle|modele|article)\b/i;

const PURCHASE = /\b(je\s+prends|je\s+commande|i['']ll\s+take)\b/i;

function norm(s: string): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isProspectGreetingMessage(message: string): boolean {
  const m = norm(message)
    .toLowerCase()
    .replace(/[.!?…]+$/g, "")
    .trim();
  return (
    /^(bonjour|bonsoir|bjr|bsr|salut|cc|coucou|hello|hi|hey|good morning|good evening|good afternoon)\b/i.test(m) ||
    /^(bonne\s+après[\s-]?midi|bonne\s+apres[\s-]?midi|bon\s+matin)\b/i.test(m) ||
    /^(hola|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches|qué\s+tal|que\s+tal)\b/i.test(m)
  );
}

/** Salutation seule — pas « tu fais quoi ? » ni question produit. */
export function isGreetingOnlyMessage(message: string): boolean {
  const raw = String(message ?? "").trim();
  if (!isProspectGreetingMessage(raw)) return false;
  const t = norm(raw).toLowerCase();
  if (PERSONAL_Q.test(t) || PRODUCT.test(t) || PURCHASE.test(t)) return false;
  if (/\b(tu\s+fais|vous\s+faites|comment\s+tu|what\s+are\s+you|qué\s+haces)\b/i.test(t)) return false;

  const withoutLead = t
    .replace(/^(hey|hi|hello|salut|coucou|cc|bonjour|bonsoir|hola|buenos\s+d[ií]as)\s*/i, "")
    .replace(/[.!?…]+$/g, "")
    .trim();
  if (withoutLead.length > 22) return false;
  if (/\?/.test(t) && withoutLead.length > 8) return false;
  return true;
}
