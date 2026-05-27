import type { HumanConversationMemory, SalesConversationGoal } from "./types";
import type {
  CommercialMemory,
  ConversationProfile,
} from "@/lib/agents/memory/conversation-state";

const HOLD_SNIPPET =
  /\b(je\s+vérifie|je\s+verifie|je\s+regarde|un\s+instant|attendez|let\s+me\s+check|one\s+moment)\b/i;

function extractAskedTopics(message: string): string[] {
  const topics: string[] = [];
  const m = String(message ?? "").trim();
  if (!m) return topics;
  if (/\b(prix|fcfa|€|budget)\b/i.test(m)) topics.push("prix");
  if (/\b(stock|dispo|disponible|pointure|taille)\b/i.test(m)) topics.push("stock_taille");
  if (/\b(livraison|délai|delai)\b/i.test(m)) topics.push("livraison");
  if (/\b(couleur|noir|blanc|bleu|rouge)\b/i.test(m)) topics.push("couleur");
  if (/\b(lien|payer|paiement|orange|mtn|wave)\b/i.test(m)) topics.push("paiement");
  return topics;
}

function extractPromises(assistantSnippet: string): string[] {
  const out: string[] = [];
  const a = String(assistantSnippet ?? "");
  if (/\b(je\s+vous\s+envoie|j['’]envoie|voici\s+le\s+lien|lien\s+ci)\b/i.test(a)) out.push("envoi_lien_infos");
  if (/\b(je\s+réserve|je\s+reserve|je\s+bloque)\b/i.test(a)) out.push("réservation");
  if (/\b(demain|dans\s+\d+\s*(min|h|heure))\b/i.test(a)) out.push("rappel_promis");
  return out;
}

/** Mémoire conversationnelle courte — continuité sans re-demander. */
export function buildConversationMemory(args: {
  message: string;
  conversationProfile?: ConversationProfile;
  commercialMemory?: CommercialMemory;
  previous?: HumanConversationMemory;
  salesGoal: SalesConversationGoal;
  lastAssistantLine?: string;
}): HumanConversationMemory {
  const prev = args.previous;
  const asked = extractAskedTopics(args.message);
  const mergedAsked = Array.from(
    new Set([...(prev?.lastAskedTopics ?? []), ...asked]),
  ).slice(-8);

  const promisesFromAssistant = args.lastAssistantLine
    ? extractPromises(args.lastAssistantLine)
    : [];
  const mergedPromises = Array.from(
    new Set([...(prev?.lastPromises ?? []), ...promisesFromAssistant]),
  ).slice(-6);

  const interest =
    args.conversationProfile?.interestLevel ?? prev?.interestLevel ?? "cold";

  const recentHold = [...(prev?.recentHoldPhrases ?? [])];
  if (args.lastAssistantLine && HOLD_SNIPPET.test(args.lastAssistantLine)) {
    recentHold.push(args.lastAssistantLine.slice(0, 48));
  }
  const trimmedHold = recentHold.slice(-4);

  return {
    lastAskedTopics: mergedAsked,
    lastPromises: mergedPromises,
    interestLevel: interest,
    lastCommercialGoal: args.salesGoal,
    recentHoldPhrases: trimmedHold,
    lastUpdatedAt: Date.now(),
  };
}

export function formatMemoryPromptLines(memory: HumanConversationMemory, lang: "fr" | "en" | "es"): string[] {
  const lines: string[] = [];
  if (memory.lastAskedTopics.length) {
    lines.push(
      lang === "en"
        ? `Already asked about: ${memory.lastAskedTopics.join(", ")} — do NOT ask again from scratch.`
        : `Déjà demandé : ${memory.lastAskedTopics.join(", ")} — ne pas reposer la même question.`,
    );
  }
  if (memory.lastPromises.length) {
    lines.push(
      lang === "en"
        ? `You already promised: ${memory.lastPromises.join(", ")} — honor it now with facts.`
        : `Déjà promis : ${memory.lastPromises.join(", ")} — tenir parole avec des faits concrets.`,
    );
  }
  if (memory.recentHoldPhrases.length >= 2) {
    lines.push(
      lang === "en"
        ? "You already used a “let me check” beat — next message MUST deliver concrete info."
        : "Vous avez déjà dit « je regarde / je vérifie » — le message suivant DOIT apporter une réponse concrète.",
    );
  }
  return lines;
}
