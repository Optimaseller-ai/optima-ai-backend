import type { BusinessFaqEntry, BusinessKnowledgeLang } from "../types";
import { formatBusinessFaqEntriesSlice } from "../business-faq-memory";

export function buildFaqMemoryBlock(entries: BusinessFaqEntry[], lang: BusinessKnowledgeLang): string {
  if (!entries.length) {
    return lang === "en"
      ? "FAQ: none configured — use verification phrase if asked."
      : "FAQ : aucune entrée — utiliser « je vérifie » si question précise.";
  }

  const body = formatBusinessFaqEntriesSlice(entries, lang);
  const guidance =
    lang === "en"
      ? "Answer in natural staff tone — quote faithfully, do not extend beyond FAQ text."
      : "Répondre comme un employé — citer fidèlement, ne pas extrapoler au-delà de la FAQ.";

  return `${body}\n${guidance}`;
}
