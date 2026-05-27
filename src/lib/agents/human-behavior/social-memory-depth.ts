/**
 * Mémoire sociale profonde — habitudes conversationnelles du prospect.
 */

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type SocialHabitTag =
  | "jokes"
  | "compares"
  | "late_replies"
  | "hesitant_buyer"
  | "direct_style"
  | "calm_style";

function normLower(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Détecte habitudes à partir d’un message utilisateur. */
export function detectSocialHabitTags(message: string): SocialHabitTag[] {
  const t = normLower(message);
  const out: SocialHabitTag[] = [];
  if (/\b(mdr|lol|haha|😂|tu\s+rigoles|blague)\b/i.test(t)) out.push("jokes");
  if (/\b(je\s+compare|autre\s+magasin|ailleurs|moins\s+cher\s+chez|vous\s+avez\s+quoi\s+d['’']?autre)\b/i.test(t)) out.push("compares");
  if (/\b(désolé\s+pour\s+le\s+retard|désolé\s+pour\s+l['’']?heure|je\s+réponds\s+tard)\b/i.test(t)) out.push("late_replies");
  if (/\b(je\s+vais\s+r[ée]fléchir|hésit|pas\s+sûr|je\s+dois\s+voir)\b/i.test(t)) out.push("hesitant_buyer");
  if (/\b(vite|direct|allez\s+y|sans\s+blabla|straight)\b/i.test(t) && t.length < 80) out.push("direct_style");
  if (t.length > 60 && !/\b(vite|urgent|!!+)\b/i.test(t) && /\b(merci|bonjour|monsieur|madame)\b/i.test(t)) out.push("calm_style");
  return out;
}

export function mergeSocialHabitTags(prev: SocialHabitTag[] | undefined, message: string, max = 6): SocialHabitTag[] {
  const seen = new Set<SocialHabitTag>(prev ?? []);
  for (const tag of detectSocialHabitTags(message)) seen.add(tag);
  return [...seen].slice(0, max);
}

export function formatSocialMemoryDepthBlock(
  state: SellerBehaviorConversationState | undefined,
  lang: "fr" | "en" | "es",
): string | null {
  const tags = state?.socialConversationHabits;
  if (!tags?.length) return null;
  const label =
    lang === "en"
      ? tags
          .map((t) => {
            const m: Record<SocialHabitTag, string> = {
              jokes: "likes light humor",
              compares: "compares options a lot",
              late_replies: "sometimes replies late",
              hesitant_buyer: "hesitates before buying",
              direct_style: "prefers direct talk",
              calm_style: "calm, unhurried tone",
            };
            return m[t];
          })
          .join("; ")
      : lang === "es"
        ? tags.join(", ")
        : tags
            .map((t) => {
              const m: Record<SocialHabitTag, string> = {
                jokes: "aime plaisanter",
                compares: "compare beaucoup",
                late_replies: "répond parfois tard",
                hesitant_buyer: "hésite avant d’acheter",
                direct_style: "style direct",
                calm_style: "style posé",
              };
              return m[t];
            })
            .join(" ; ");
  if (lang === "en") {
    return `SOCIAL MEMORY (adapt quietly): ${label}. Mirror without announcing it.`;
  }
  if (lang === "es") {
    return `MEMORIA SOCIAL: ${label}. Adáptese con naturalidad.`;
  }
  return [
    "MÉMOIRE SOCIALE (adapter en douceur, sans le dire):",
    `- Habitudes notées : ${label}.`,
    "- Prospect plaisantin → ton un peu plus détendu ; compareur → honnête sur les options ; pressé → direct ; hésitant → patient, sans forcer.",
  ].join("\n");
}
