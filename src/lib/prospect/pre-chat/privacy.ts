/**
 * Utilitaires confidentialité — ne pas exposer PII en clair dans les logs.
 */

export function maskEmail(email: string): string {
  const e = String(email ?? "").trim();
  const at = e.indexOf("@");
  if (at < 2) return "***";
  return `${e.slice(0, 2)}***${e.slice(at)}`;
}

export function maskPhone(phone: string): string {
  const d = String(phone ?? "").replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `***${d.slice(-4)}`;
}

export function hashContactStable(contact: string): string {
  let h = 2166136261 >>> 0;
  const s = String(contact ?? "").trim().toLowerCase();
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return (h >>> 0).toString(36);
}
