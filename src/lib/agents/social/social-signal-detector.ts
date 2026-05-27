import { isGreetingOnlyMessage, isProspectGreetingMessage } from "./greeting-utils";
import { isHesitationSignalMessage } from "./hesitation-signal-engine";
import {
  SOCIAL_DAY_OR_MOOD,
  SOCIAL_PERSONAL_ACTIVITY,
  SOCIAL_PRODUCT,
  SOCIAL_QUESTION_REPEAT,
  SOCIAL_WELLBEING,
  SOCIAL_WELLBEING_FOLLOWUP,
  SOCIAL_WELLBEING_FOLLOWUP_INLINE,
} from "./social-signal-patterns";
import type { SocialSignalKind } from "./types";

const THANKS = /\b(merci\s*(beaucoup|bcp)?|thanks|thank\s+you|gracias)\b/i;

const FAREWELL_NIGHT = /\b(bonne\s+nuit|bonne\s+soirée|bonne\s+soiree|good\s+night|good\s+evening|buenas\s+noches)\b/i;

const FAREWELL_DAY = /\b(bonne\s+journée|bonne\s+journee|bonne\s+après[\s-]?midi|à\s+plus|a\s+plus|à\s+bientôt|a\s+bientot)\b/i;

const CASUAL_ACK = /^(ok|okay|d['’]accord|dac|oui|yes|vale|perfecto|parfait|super)[\s!.?]*$/i;

function normalizeSocialText(message: string): string {
  return String(message ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Détecte signaux sociaux purs (priorité sur la vente). */
export function detectSocialSignal(message: string): SocialSignalKind {
  const raw = String(message ?? "").trim();
  const m = normalizeSocialText(raw);
  if (!m) return "none";

  if (SOCIAL_PRODUCT.test(m) && (SOCIAL_PERSONAL_ACTIVITY.test(m) || /\b(je\s+veux|commande)\b/i.test(m))) {
    return "none";
  }

  if (FAREWELL_NIGHT.test(m)) return "farewell_night";
  if (FAREWELL_DAY.test(m) && !SOCIAL_PRODUCT.test(m)) return "farewell_day";
  if (THANKS.test(m) && m.length < 80 && !SOCIAL_PRODUCT.test(m)) return "thanks";

  if (
    SOCIAL_QUESTION_REPEAT.test(m) &&
    (SOCIAL_DAY_OR_MOOD.test(m) || SOCIAL_PERSONAL_ACTIVITY.test(m) || SOCIAL_WELLBEING_FOLLOWUP_INLINE.test(m))
  ) {
    return "question_repeat";
  }

  if (
    SOCIAL_WELLBEING_FOLLOWUP.test(raw) ||
    (/^et\s+vous\s*\??\s*$/i.test(raw) && raw.length < 30) ||
    (/^et\s+toi\s*\??\s*$/i.test(raw) && raw.length < 25)
  ) {
    return "wellbeing_followup";
  }

  if (SOCIAL_WELLBEING_FOLLOWUP_INLINE.test(m) && !SOCIAL_PRODUCT.test(m) && m.length < 80) {
    return "wellbeing_followup";
  }

  if (SOCIAL_PERSONAL_ACTIVITY.test(m) && !SOCIAL_PRODUCT.test(m)) return "personal_activity";
  if (SOCIAL_WELLBEING.test(m) && !SOCIAL_PRODUCT.test(m)) return "wellbeing";

  if (/\b(bonsoir)\b/i.test(m) && isGreetingOnlyMessage(raw)) return "greeting_evening";
  if (isGreetingOnlyMessage(raw) || (isProspectGreetingMessage(raw) && m.length < 40 && !SOCIAL_PERSONAL_ACTIVITY.test(m))) {
    return /\b(bonsoir)\b/i.test(m) ? "greeting_evening" : "greeting";
  }

  if (/^(bonjour|salut|coucou|hello|hi|hey|hola)[\s!.?]*$/i.test(m)) return "greeting";
  if (isHesitationSignalMessage(raw)) return "hesitation";
  if (CASUAL_ACK.test(m)) return "casual_ack";

  return "none";
}

export function isSocialSignalKind(signal: SocialSignalKind): boolean {
  return signal !== "none";
}
