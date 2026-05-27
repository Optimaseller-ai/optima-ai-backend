/**
 * Optima commercial agents — architecture modulaire.
 *
 * Couches :
 * - memory : état conversation, profil prospect, mémoire commerciale
 * - sales : intention, opportunité, cross-sell
 * - personality : agents catalogue + prompts persona
 * - timing : fuseau business, fenêtres silencieuses
 * - followups : relances, hold « je vérifie », traitement queue
 * - business-context : RAG catalogue + pipeline `generateAIReply`
 * - prompts : construction des prompts LLM (premium seller)
 * - salesBrain : moteur de décision commerciale (stratégie, objections, close, upsell)
 * - humanConversation : orchestrateur ton humain, priorité intention, anti-hold
 * - emotionalIntelligence : détection émotion, confiance, empathie, adaptation vente
 * - personality : catalogue agents + moteur cohérence personnalité
 * - social : couche humanisation sociale prioritaire (salutations, small talk)
 */

export * as social from "./social";

export * as memory from "./memory";
export * as sales from "./sales";
export * as salesBrain from "./sales-brain";
export * as humanConversation from "./human-conversation";
export * as emotionalIntelligence from "./emotional-intelligence";
export * as personality from "./personality";
export * as timing from "./timing";
export * as followups from "./followups";
export * as businessContext from "./business-context";
export * as prompts from "./prompts/premium";
