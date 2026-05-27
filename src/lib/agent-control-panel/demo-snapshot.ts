import type { AgentControlSnapshot } from "./snapshot-types";

/**
 * Données de démonstration — tout est déjà calculé côté « serveur » simulé.
 */
export const demoAgentControlSnapshot: AgentControlSnapshot = {
  updatedAt: new Date().toISOString(),
  prospect: {
    id: "prospect-demo-01",
    sessionId: "sess_chat_8f2a",
    name: "Nadine K.",
    phone: "+237 6•• •• •• 42",
    email: "nadine•••@email.com",
    city: "Douala",
    country: "CM",
    preferredLanguage: "fr",
    tags: ["price-sensitive", "hot-lead", "hesitant"],
    salesScore: 78,
    status: "hot",
    intents: ["price_inquiry", "delivery_inquiry", "purchase_intent"],
    products: ["Robe cocktail satin", "Ceinture assortie"],
    historySummary:
      "Intéressée par la robe ; a demandé prix + délai Douala. Deux allers-retours sur la taille ; ton positif depuis hier soir.",
    lastActivityAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    nextAction: "Envoyer récap commande + confirmation créneau livraison.",
  },
  salesInsight: {
    strategy: "closing — micro-étape + détails commande",
    objection: "Livraison / délai (catégorie delivery)",
    decisionReason:
      "Score commercial élevé + intention d’achat détectée ; objection logistique levée par réponse courte sur créneau.",
    urgencyLevel: "medium",
    nextRecommendation: "Proposer validation maintenant ou envoi des détails commande (niveau medium close).",
  },
  timeline: [
    {
      id: "tl-1",
      at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      kind: "message",
      label: "Message prospect",
      detail: "Ok pour Douala demain si le prix catalogue tient.",
    },
    {
      id: "tl-2",
      at: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
      kind: "intent",
      label: "Intention détectée",
      detail: "purchase_intent · confiance 0.84",
    },
    {
      id: "tl-3",
      at: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
      kind: "followup_scheduled",
      label: "Relance programmée",
      detail: "WhatsApp J+1 · file automation_queue",
    },
    {
      id: "tl-4",
      at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      kind: "email_sent",
      label: "Email envoyé",
      detail: "Lookbook robes — lien catalogue (log ESP)",
    },
    {
      id: "tl-5",
      at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      kind: "action",
      label: "Action déclenchée",
      detail: "Sales brain · strategy=closing · next_action=send_order_details",
    },
    {
      id: "tl-6",
      at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      kind: "message",
      label: "Message agent",
      detail: "Je te confirme stock + créneaux Douala en une phrase après ton OK taille.",
    },
  ],
  agent: {
    status: "waiting_approval",
    label: "Deux actions en attente de validation humaine.",
  },
};
