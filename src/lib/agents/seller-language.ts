/**
 * Langue conversationnelle + normalisation — réexporte la détection centralisée (FR / EN / ES).
 */

import {
  detectConversationLanguage,
  type ConversationLanguage,
} from "@/lib/ai/language-detection";

export type SellerLanguage = ConversationLanguage;

export function norm(s: string) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Alias historique — préférer `detectConversationLanguage` côté nouveau code. */
export const detectDominantLanguage = detectConversationLanguage;

export { detectConversationLanguage, type ConversationLanguage } from "@/lib/ai/language-detection";
