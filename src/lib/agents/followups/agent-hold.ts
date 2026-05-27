import "server-only";

import type { SellerIntent } from "@/lib/agents/memory/conversation-state";

function norm(s: string) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Réponses courtes type « je vérifie » : déclenche un follow-up automatique avec vraie réponse catalogue.
 */
export function isAgentHoldReply(text: string): boolean {
  const t = norm(text);
  if (!t || t.length > 140) return false;

  const fr =
    /^je regarde\b/i.test(t) ||
    /^je vérifie\b/i.test(t) ||
    /^je viens de vérifier\b/i.test(t) ||
    /^un instant\b/i.test(t) ||
    /^attendez je regarde\b/i.test(t) ||
    /^deux minutes\b/i.test(t) ||
    /^2 minutes\b/i.test(t) ||
    /\bun instant je vérifie\b/i.test(t) ||
    /\bun instant s'il vous plaît\b/i.test(t) ||
    /\bje regarde cela\b/i.test(t);

  const en =
    /^just a moment\b/i.test(t) ||
    /^one moment please\b/i.test(t) ||
    /^let me check\b/i.test(t) ||
    /\blet me check that\b/i.test(t);

  return fr || en;
}

/**
 * Délai avant le 2e message (file `pending_agent_followups` = queue serveur).
 * Vérification stock / prix: 20–60 s comme demandé.
 */
export function followupDelayMs(intent?: SellerIntent): number {
  if (intent === "stock_inquiry" || intent === "price_inquiry") {
    return 20_000 + Math.floor(Math.random() * 40_001);
  }
  return 12_000 + Math.floor(Math.random() * 28_001);
}
