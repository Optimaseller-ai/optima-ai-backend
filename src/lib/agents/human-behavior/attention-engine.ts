/**
 * Attention « vraie écoute » — prompts + rappel mémoire émotionnelle.
 * Client + serveur.
 */

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { mapMemoryKindToPromptHint } from "@/lib/agents/human-behavior/response-weight-system";

export type AttentionLang = "fr" | "en" | "es";

export function formatAttentionEnginePromptBlock(lang: AttentionLang): string {
  if (lang === "en") {
    return [
      "REAL HUMAN ATTENTION (listening, not cataloguing):",
      "- Mirror the constraint in plain words before pitching: if they want “simple and not too expensive”, acknowledge that shape (“so something simple, budget‑friendly”) — not “we have many products”.",
      "- One short human beat of understanding, then useful fact or question.",
      "- Sales must feel contextual: if they want durability, advise against the weak option and name the better one — not a generic upsell script.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "ATENCIÓN HUMANA REAL:",
      "- Reformule lo que entendió (simple / barato / resistente) antes del catálogo.",
      "- La venta nace del contexto, no del forzado.",
    ].join("\n");
  }
  return [
    "ATTENTION HUMAINE RÉELLE (écoute, pas inventaire):",
    "- Rebondir sur ce qu’ils viennent de dire : si « simple et pas trop cher », accusez (« donc plutôt quelque chose de simple alors » / « d’accord, on reste sur du raisonnable niveau prix ») — pas « nous avons plusieurs produits disponibles ».",
    "- Vente contextuelle : si « qui dure », orienter honnêtement (éviter le modèle faible, proposer le plus solide) — pas argumentaire artificiel.",
    "- Présence > intelligence : mieux paraître présent et juste que brillant et creux.",
  ].join("\n");
}

/**
 * Rappel discret d’un épisode émotionnel passé (nouvelle session / reprise après plusieurs heures).
 */
export function formatEmotionalRecallPromptBlock(
  state: SellerBehaviorConversationState | undefined,
  lang: AttentionLang,
): string | null {
  const mem = state?.prospectEmotionalMemory;
  if (!mem) return null;
  const gapMs = Date.now() - mem.recordedAt;
  if (gapMs < 5 * 60 * 60 * 1000) return null;
  const hint = mapMemoryKindToPromptHint(mem.kind, lang);
  if (lang === "en") {
    return [
      "EMOTIONAL MEMORY (subtle, optional):",
      `- Earlier in this thread the customer ${hint}.`,
      "- If they reopen politely (evening greeting, etc.), you MAY add one very short human check‑in (“hope today feels a bit smoother”) — never therapist tone, never forced.",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "MEMORIA EMOCIONAL (sutil, opcional):",
      `- Antes el cliente ${hint}.`,
      "- Si retoman con cordialidad, puede una frase muy breve de seguimiento humano — sin tono psicólogo.",
    ].join("\n");
  }
  return [
    "MÉMOIRE ÉMOTIONNELLE (rappel discret, optionnel):",
    `- Plus tôt dans l’échange le prospect ${hint}.`,
    "- Si la reprise est cordiale (ex. bonsoir) après une coupure, UNE micro-phrase humaine peut convenir (« j’espère que ça va un peu mieux aujourd’hui ») — sans insistance, sans ton psy, jamais obligatoire.",
  ].join("\n");
}
