import {
  englishHonorificSmart,
  frenchHonorificSmart,
  spanishHonorificSmart,
} from "@/lib/agents/memory/prospect-profile";
import { getCommercialAgentById, resolveCommercialAgentKey } from "@/lib/agents/personality/commercial-agents";
import { getAgentPersonalityProfile } from "@/lib/agents/personality/persona-prompts";
import { buildHesitationReply, isHesitationSignalMessage } from "./hesitation-signal-engine";
import { buildHumanSocialGreetingReply } from "./human-social-replies";
import { detectSocialSignal } from "./social-signal-detector";
import {
  SOCIAL_DAY_OR_MOOD,
  SOCIAL_PERSONAL_ACTIVITY,
  SOCIAL_QUESTION_REPEAT,
  SOCIAL_WELLBEING_FOLLOWUP_INLINE,
} from "./social-signal-patterns";
import type { SocialSignalKind } from "./types";
import type { GreetingReplyInput } from "./human-greeting-engine";

const COMMERCIAL =
  /\b(prix|stock|dispo|commander|acheter|livraison|modèle|modele|article|lien|payer|fcfa|€|devis|facture)\b/i;

const GENERIC_DACORD_ONLY = /^d['']?accord\s*[.!?…]*$/i;

export type ContextualSocialReplyInput = GreetingReplyInput & {
  signal?: SocialSignalKind;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length]!;
}

function mirrorSalutationFr(message: string): "Bonsoir" | "Bonjour" | "Salut" {
  const m = String(message ?? "").toLowerCase();
  if (/\b(bonsoir|bsr)\b/.test(m)) return "Bonsoir";
  if (/\b(salut|coucou|cc|hey|hi)\b/.test(m)) return "Salut";
  return "Bonjour";
}

function extractGreetingName(message: string): string | null {
  const m = String(message ?? "").trim();
  const hit = m.match(
    /(?:^|\s)(?:bonsoir|bonjour|salut|coucou|bsr|hey|hi|hello)\s+([a-zàâäéèêëïîôùûüç][a-zàâäéèêëïîôùûüç\-]{1,22})\b/i,
  );
  const name = hit?.[1]?.trim();
  if (!name || /^(monsieur|madame|mme|mr|mrs)$/i.test(name)) return null;
  const cap = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  return cap;
}

function agentApologyFr(personaKey?: string | null): string {
  const id = resolveCommercialAgentKey(personaKey) ?? "grace";
  const def = getCommercialAgentById(id);
  return def?.gender === "female" ? "désolée" : "désolé";
}

function agentDisplayName(personaKey?: string | null, fallback?: string): string {
  const id = resolveCommercialAgentKey(personaKey) ?? "grace";
  return getAgentPersonalityProfile(id)?.displayName ?? fallback ?? "Vanessa";
}

function buildWellbeingFollowupFr(input: ContextualSocialReplyInput): string {
  const honor = frenchHonorificSmart(input.prospectProfile);
  const h = honor ? ` ${honor}` : "";
  const smile = input.allowEmoji ? " 🙂" : "";
  const seed = input.message + "wellbeing_followup";
  return pick(
    [
      `Bien merci${smile} — et vous${h} ?`,
      `Ça va bien de mon côté${smile}. Et vous${h} ?`,
      `Ma journée se passe bien merci${smile} — et la vôtre${h} ?`,
      `Très bien merci${smile}. Et vous${h}, comment ça va ?`,
    ],
    seed,
  );
}

function buildPersonalActivityFr(input: ContextualSocialReplyInput): string {
  const biz = input.businessName.trim() || "la boutique";
  const smile = input.allowEmoji ? " 🙂" : "";
  const name = agentDisplayName(input.personaKey, input.agentName);
  const seed = input.message + "personal";
  return pick(
    [
      `Je réponds aux clients sur WhatsApp pour ${biz} là${smile} — tranquille.`,
      `Je suis connectée pour ${biz} aujourd'hui${smile}, je gère les messages.`,
      `Là je suis sur les messages ${biz}${smile} — pas de stress.`,
      `Je bosse côté ${biz} sur WhatsApp${smile} — ${name}, pour vous aider quand il faut.`,
    ],
    seed,
  );
}

function buildQuestionRepeatFr(input: ContextualSocialReplyInput): string {
  const honor = frenchHonorificSmart(input.prospectProfile);
  const h = honor ? ` ${honor}` : "";
  const smile = input.allowEmoji ? " 🙂" : "";
  const raw = String(input.message ?? "").trim();

  if (SOCIAL_DAY_OR_MOOD.test(raw) || SOCIAL_WELLBEING_FOLLOWUP_INLINE.test(raw)) {
    return pick(
      [
        `Pardon si ce n'était pas clair${h}${smile} — ma journée va bien, et vous ?`,
        `Ah pardon${h}${smile} — ça va bien merci. Et vous${h} ?`,
        `Oui bien sûr${h}${smile} — ma journée se passe bien. Et la vôtre ?`,
      ],
      input.message + "repeat_day",
    );
  }

  if (SOCIAL_PERSONAL_ACTIVITY.test(raw)) {
    return `Pardon${h}${smile} — ${buildPersonalActivityFr(input).toLowerCase().replace(/^./, (c) => c.toUpperCase())}`;
  }

  return pick(
    [
      `Pardon${h}${smile} je n'avais pas été assez claire — je vous écoute.`,
      `Ah désolée${h}${smile} — dites-moi, je reprends.`,
    ],
    input.message + "repeat_generic",
  );
}

function buildReplyForSignal(signal: SocialSignalKind, input: ContextualSocialReplyInput): string | null {
  const raw = String(input.message ?? "").trim();
  if (!raw || COMMERCIAL.test(raw)) return null;

  const smile = input.allowEmoji ? " 🙂" : "";
  const lang = input.lang;

  if (lang === "en") {
    const honor = englishHonorificSmart(input.prospectProfile);
    const h = honor ? ` ${honor}` : "";
    switch (signal) {
      case "wellbeing_followup":
        return pick([`Doing well${smile} — and you${h}?`, `All good${smile}. You?`], raw);
      case "personal_activity":
        return pick(
          [`I'm on WhatsApp for ${input.businessName} right now${smile}.`, `Handling customer messages${smile} — quiet day.`],
          raw,
        );
      case "question_repeat":
        return `Sorry if I missed that${h}${smile} — I'm doing well. And you?`;
      case "wellbeing":
        return pick([`Doing well, thanks${h}${smile}. You?`, `All good${h}${smile}.`], raw);
      default:
        return null;
    }
  }

  if (lang === "es") {
    const honor = spanishHonorificSmart(input.prospectProfile);
    const h = honor ? ` ${honor}` : "";
    switch (signal) {
      case "wellbeing_followup":
        return pick([`Bien, gracias${smile}. ¿Y usted${h}?`, `Todo bien${smile} — ¿y usted?`], raw);
      case "personal_activity":
        return `Estoy atendiendo mensajes de ${input.businessName}${smile}.`;
      case "question_repeat":
        return `Perdone${h}${smile} — todo bien por aquí. ¿Y usted?`;
      default:
        return null;
    }
  }

  const honor = frenchHonorificSmart(input.prospectProfile);
  const honorSuffix = honor ? ` ${honor}` : "";

  switch (signal) {
    case "wellbeing_followup":
      return buildWellbeingFollowupFr(input);
    case "personal_activity":
      return buildPersonalActivityFr(input);
    case "question_repeat":
      return buildQuestionRepeatFr(input);
    case "wellbeing":
      if (
        /\b(ça\s+va|ca\s+va|la\s+journée|comment\s+vas|comment\s+allez)\b/i.test(raw) &&
        /\b(ah\s+ok|ok\s+la|dac|d'accord)\b/i.test(raw)
      ) {
        return `Ça va bien merci${honorSuffix}${smile} et vous ?`;
      }
      return pick(
        [
          `Ça va bien merci${honorSuffix}${smile}.`,
          `Très bien merci${honorSuffix}${smile} — et vous ?`,
          `Oui tout va bien${honorSuffix}${smile}.`,
        ],
        raw,
      );
    case "thanks":
      return `Avec plaisir${honorSuffix}${smile}.`;
    case "hesitation":
      return buildHesitationReply({
        message: raw,
        agentName: input.agentName,
        businessName: input.businessName,
        prospectProfile: input.prospectProfile,
        allowEmoji: input.allowEmoji,
        lang: input.lang ?? "fr",
        history: input.history,
      });
    case "greeting":
    case "greeting_evening": {
      if (extractGreetingName(raw)) {
        const salute = mirrorSalutationFr(raw);
        return `${salute}${smile}\ncomment allez-vous ?`;
      }
      return buildHumanSocialGreetingReply(input);
    }
    default:
      return null;
  }
}

/**
 * Réponses sociales contextuelles — priorité sur scripts commerciaux et « D'accord » seul.
 */
export function buildContextualSocialReply(input: ContextualSocialReplyInput): string | null {
  const raw = String(input.message ?? "").trim();
  if (!raw || raw.length > 220 || COMMERCIAL.test(raw)) return null;

  const signal = input.signal ?? detectSocialSignal(raw);
  if (signal === "none") return buildLegacyContextualPatterns(input, raw);

  const bySignal = buildReplyForSignal(signal, input);
  if (bySignal && !GENERIC_DACORD_ONLY.test(bySignal.trim())) return bySignal;

  return buildLegacyContextualPatterns(input, raw);
}

/** Patterns historiques + cas mixtes non couverts par le signal seul. */
function buildLegacyContextualPatterns(input: ContextualSocialReplyInput, raw: string): string | null {
  const smile = input.allowEmoji ? " 🙂" : "";
  const lang = input.lang;

  if (lang !== "fr") return null;

  const honor = frenchHonorificSmart(input.prospectProfile);
  const honorSuffix = honor ? ` ${honor}` : "";

  if (/\b(tu|vous)\s+d[ée]range/i.test(raw)) {
    return `Oh ${agentApologyFr(input.personaKey)} si je vous ai dérangé${honorSuffix}${smile}.`;
  }

  if (/^(merci|merci\s+beaucoup|thanks|gracias)[\s!.?👍🙏]*$/i.test(raw)) {
    return `Avec plaisir${honorSuffix}${smile}.`;
  }

  if (/\bah\s+(ok|d'accord|dac)\s+merci/i.test(raw)) {
    return `Avec plaisir${honorSuffix}${smile}.`;
  }

  if (SOCIAL_WELLBEING_FOLLOWUP_INLINE.test(raw)) {
    return buildWellbeingFollowupFr(input);
  }

  if (SOCIAL_PERSONAL_ACTIVITY.test(raw)) {
    return buildPersonalActivityFr(input);
  }

  if (SOCIAL_QUESTION_REPEAT.test(raw) && SOCIAL_DAY_OR_MOOD.test(raw)) {
    return buildQuestionRepeatFr(input);
  }

  if (
    (isHesitationSignalMessage(raw) || /\b(hmm|hum|euh)\b/i.test(raw)) &&
    /\b(rien\s+pour\s+le\s+moment|pas\s+encore|pour\s+l['’]?instant)\b/i.test(raw)
  ) {
    return `Je reste disponible si besoin${honorSuffix}${smile}.`;
  }

  if (/\b(bonsoir|bonjour|salut|coucou)\b/i.test(raw) && extractGreetingName(raw)) {
    const salute = mirrorSalutationFr(raw);
    return `${salute}${smile}\ncomment allez-vous ?`;
  }

  if (/\b(bonsoir|bonjour|salut)\b/i.test(raw) && raw.length < 60 && !/\b(prix|commande)\b/i.test(raw)) {
    return buildHumanSocialGreetingReply(input);
  }

  return null;
}

/** Jamais « D'accord » seul si un signal social est connu. */
export function resolveSocialReplyForKnownSignal(
  signal: SocialSignalKind,
  input: ContextualSocialReplyInput,
): string | null {
  if (signal === "none") return null;
  return buildContextualSocialReply({ ...input, signal });
}
