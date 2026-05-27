import type { ConversationLanguage } from "@/lib/ai/language-detection";
import {
  buildBusinessHoursPriorityReply,
  resolveBusinessHoursContext,
  userAsksAboutHours,
} from "@/lib/agents/business-data/business-data-priority";
import { buildEffortAwareReply, detectProspectEffort } from "@/lib/agents/human-behavior/effort-detection";
import {
  buildEmotionalPriorityReply,
  type ConversationEmotionProfile,
} from "@/lib/agents/emotional-intelligence/conversation-emotion-classifier";
import type { ExtendedBusinessFacts } from "@/lib/business-brain/context/business-brain-args";

/** Messages ultra-courts autorisés pour social_quick_minimal uniquement. */
const MICRO_SOCIAL_ONLY =
  /^(bonjour|bonsoir|salut|coucou|cc|yo|hello|hi|hey|hola|buenos\s+d[ií]as|bonne\s+journ[eé]e|bonne\s+soir[eé]e)[\s!.?👋🙂]*$/i;

const COMPLAINT_VISIT_CONTEXT =
  /\b(passé|passée|venu|venue|boutique|magasin|fermé|fermée|ferme|déplacé|déplacement|pas\s+trouvé|2\s+fois|deux\s+fois|franchement)\b/i;

export function isAllowedMicroSocialMessage(message: string): boolean {
  const m = String(message ?? "").trim();
  if (!m || m.length > 32) return false;
  if (COMPLAINT_VISIT_CONTEXT.test(m)) return false;
  if (userAsksAboutHours(m)) return false;
  return MICRO_SOCIAL_ONLY.test(m);
}

export function shouldAllowSocialQuickPath(args: {
  message: string;
  emotion: ConversationEmotionProfile;
  disableSocialFallback: boolean;
}): boolean {
  if (args.disableSocialFallback) return false;
  if (args.emotion.blocks_social_quick) return false;
  if (!isAllowedMicroSocialMessage(args.message)) return false;
  return true;
}

export function isPureHoursInquiry(message: string): boolean {
  if (COMPLAINT_VISIT_CONTEXT.test(message)) return false;
  if (detectProspectEffort(message).effort_detected) return false;
  return userAsksAboutHours(message);
}

/**
 * Réponses prioritaires (empathie / visite / horaires) — avant tout fallback social.
 */
export function buildCriticalPriorityReply(args: {
  message: string;
  lang: ConversationLanguage;
  emotion: ConversationEmotionProfile;
  facts?: ExtendedBusinessFacts | null;
  timezone?: string;
  businessName?: string;
}): string | null {
  const effort = detectProspectEffort(args.message);

  const emotional = buildEmotionalPriorityReply({
    profile: args.emotion,
    lang: args.lang,
    businessName: args.businessName ?? "la boutique",
    agentName: "Conseillère",
    message: args.message,
  });
  if (emotional) return emotional;

  if (effort.effort_detected) {
    const hoursCtx = resolveBusinessHoursContext({ facts: args.facts, timezone: args.timezone });
    return buildEffortAwareReply({
      detection: effort,
      lang: args.lang,
      businessName: args.businessName,
      hasBusinessHours: hoursCtx.has_business_hours,
    });
  }

  if (isPureHoursInquiry(args.message)) {
    const hoursCtx = resolveBusinessHoursContext({ facts: args.facts, timezone: args.timezone });
    return buildBusinessHoursPriorityReply({
      message: args.message,
      ctx: hoursCtx,
      lang: args.lang,
      businessName: args.businessName,
    });
  }

  return null;
}
