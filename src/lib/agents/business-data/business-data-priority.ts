import { DateTime } from "luxon";
import type { ExtendedBusinessFacts } from "@/lib/business-brain/context/business-brain-args";

export type BusinessHoursContext = {
  has_business_hours: boolean;
  weekday: string | null;
  weekend: string | null;
  timezone: string;
};

const HOURS_QUESTION =
  /\b(horaire|horaires|ouverts?|ouverture|fermés?|ferme|fermeture|à\s+quelle\s+heure|quelle\s+heure|quel\s+heure|passer\s+à|venir\s+quand|disponible\s+quand|open|close|opening\s+hours|business\s+hours)\b/i;

const VISIT_COMPLAINT_CONTEXT =
  /\b(passé|passée|venu|venue|boutique|magasin|fermé|fermée|ferme|c['']était\s+fermé|pas\s+trouvé|déplacement|franchement|2\s+fois|hier)\b/i;

const FAKE_VERIFICATION_FR =
  /\b(je\s+vais\s+vérifier|je\s+vais\s+verifier|je\s+vérifie|je\s+verifie|je\s+regarde|je\s+consulte|je\s+reviens\s+vers\s+vous|un\s+instant\s+je\s+regarde|laissez[- ]?moi\s+vérifier)\b/i;

const FAKE_VERIFICATION_EN =
  /\b(let\s+me\s+check|i(?:'|')?ll\s+check|i\s+am\s+checking|give\s+me\s+a\s+moment\s+to\s+verify)\b/i;

export function userAsksAboutHours(message: string): boolean {
  const m = String(message ?? "").trim();
  if (!m) return false;
  if (VISIT_COMPLAINT_CONTEXT.test(m)) return false;
  return HOURS_QUESTION.test(m);
}

export function resolveBusinessHoursContext(args: {
  facts?: ExtendedBusinessFacts | Record<string, string> | null;
  timezone?: string | null;
}): BusinessHoursContext {
  const raw = args.facts ?? {};
  const weekday =
    String((raw as ExtendedBusinessFacts).openHoursWeekday ?? (raw as Record<string, string>).openHoursWeekday ?? "").trim() ||
    null;
  const weekend =
    String((raw as ExtendedBusinessFacts).weekendHoursNote ?? (raw as Record<string, string>).weekendHoursNote ?? "").trim() ||
    null;
  const has_business_hours = Boolean(weekday || weekend);
  return {
    has_business_hours,
    weekday,
    weekend,
    timezone: String(args.timezone ?? "").trim() || "Africa/Douala",
  };
}

function todayHoursHint(ctx: BusinessHoursContext): string | null {
  if (!ctx.weekday) return null;
  const z = ctx.timezone;
  const now = DateTime.now().setZone(z);
  const isWeekend = now.isValid && (now.weekday === 6 || now.weekday === 7);
  if (isWeekend && ctx.weekend) return ctx.weekend;
  return ctx.weekday;
}

export function buildBusinessHoursPriorityReply(args: {
  message: string;
  ctx: BusinessHoursContext;
  lang: "fr" | "en" | "es";
  businessName?: string;
}): string | null {
  if (!userAsksAboutHours(args.message)) return null;

  const { ctx, lang } = args;

  if (ctx.has_business_hours) {
    const today = todayHoursHint(ctx);
    if (lang === "en") {
      if (today) return `You can come by today during our opening hours: ${today} 😊`;
      const parts = [ctx.weekday, ctx.weekend ? `Weekend: ${ctx.weekend}` : null].filter(Boolean);
      return `Our opening hours: ${parts.join(" — ")} 😊`;
    }
    if (lang === "es") {
      if (today) return `Puede pasar hoy en este horario: ${today} 😊`;
      const parts = [ctx.weekday, ctx.weekend ? `Fin de semana: ${ctx.weekend}` : null].filter(Boolean);
      return `Horario de la tienda: ${parts.join(" — ")} 😊`;
    }
    if (today) return `Vous pouvez passer aujourd'hui : ${today} 😊`;
    const parts = [ctx.weekday, ctx.weekend ? `Week-end : ${ctx.weekend}` : null].filter(Boolean);
    return `Nos horaires : ${parts.join(" — ")} 😊`;
  }

  if (lang === "en") {
    return "I don't have the exact store hours yet, but I can ask the manager for you.";
  }
  if (lang === "es") {
    return "Aún no tengo el horario exacto de la tienda, pero puedo preguntar al responsable por usted.";
  }
  return "Je n'ai pas encore les horaires exacts de la boutique, mais je peux demander au responsable pour vous.";
}

export function stripFakeVerificationPhrases(
  text: string,
  lang: "fr" | "en" | "es",
  hasRealBackendAction = false,
): string {
  if (hasRealBackendAction || !text.trim()) return text;
  const re = lang === "en" ? FAKE_VERIFICATION_EN : FAKE_VERIFICATION_FR;
  const sentences = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = sentences.filter((s) => !re.test(s));
  return kept.join(" ").trim();
}
