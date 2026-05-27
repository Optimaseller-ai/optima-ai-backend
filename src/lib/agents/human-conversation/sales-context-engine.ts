import type { SalesConversationGoal } from "./types";
import type { SellerIntent } from "@/lib/agents/memory/conversation-state";

/** Comprend ce que le prospect veut faire dans l’échange. */
export function inferSalesConversationGoal(args: {
  message: string;
  sellerIntent?: SellerIntent;
}): SalesConversationGoal {
  const m = String(args.message ?? "").toLowerCase();

  if (
    /\b(parler\s+à\s+(un\s+)?humain|un\s+vrai\s+conseiller|responsable|manager|gérant|gerant|appelez[- ]?moi)\b/i.test(m) ||
    /\b(speak\s+to\s+a\s+human|real\s+person|manager)\b/i.test(m)
  ) {
    return "human_handoff";
  }

  if (/\b(livraison|livrer|transport|délai|delai|expédition|expedition|suivi\s+colis|adresse)\b/i.test(m)) {
    return "delivery";
  }

  if (
    /\b(arnaque|confiance|garantie|retour|remboursement|déçu|decu|déception|deception|pas\s+reçu|pas\s+recu)\b/i.test(m) ||
    args.sellerIntent === "complaint"
  ) {
    return "reassure";
  }

  if (/\b(comparer|vs\.?|versus|concurrent|autre\s+boutique|moins\s+cher\s+ailleurs|lequel\s+est\s+mieux)\b/i.test(m)) {
    return "compare";
  }

  if (
    /\b(acheter|commander|je\s+prends|lien\s+de\s+paiement|payer|valider|réserver|reserver)\b/i.test(m) ||
    args.sellerIntent === "purchase_intent"
  ) {
    return "buy";
  }

  if (/\b(plainte|problème|probleme|cassé|casse|défectueux|defectueux)\b/i.test(m)) {
    return "support";
  }

  if (/\b(catalogue|modèle|modele|qu['’]est[- ]ce que vous avez|vous\s+avez\s+quoi|montrez|montrer)\b/i.test(m)) {
    return "discover";
  }

  if (/\b(bonjour|salut|coucou|bonsoir|hello|hi)\b/i.test(m) && m.length < 35) {
    return "chat";
  }

  return "discover";
}
