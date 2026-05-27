import "server-only";

import { detectSocialIntent } from "./social-intent-engine";
import type { SellerLanguage } from "@/lib/agents/seller-language";

const WELCOME_FR = /\b(bienvenue\s+chez|bonjour\s+et\s+bienvenue|bienvenue\s+à)\b[^.!?…]*/gi;
const WELCOME_EN = /\b(welcome\s+to|hello\s+and\s+welcome)\b[^.!?…]*/gi;
const WELCOME_ES = /\b(bienvenido\s+a|hola\s+y\s+bienvenido)\b[^.!?…]*/gi;

const SUPPORT_FR =
  /\b(comment\s+puis[- ]je\s+vous\s+aider|en\s+quoi\s+puis[- ]je|que\s+puis[- ]je\s+faire\s+pour\s+vous|je\s+suis\s+l[àà]\s+pour\s+vous\s+aider)\b[^.!?…]*/gi;
const SUPPORT_EN = /\b(how\s+can\s+i\s+help|what\s+can\s+i\s+do\s+for\s+you|how\s+may\s+i\s+assist)\b[^.!?…]*/gi;
const SUPPORT_ES = /\b(en\s+qu[eé]\s+puedo\s+ayudarle|cómo\s+puedo\s+ayudarle)\b[^.!?…]*/gi;

const PERSONAL_FALLBACK_FR = [
  "Je suis encore au bureau.",
  "Je vérifie quelques commandes.",
  "Je travaille encore un peu.",
];
const PERSONAL_FALLBACK_EN = ["Still at the shop.", "Checking a few orders.", "Still working a bit."];
const PERSONAL_FALLBACK_ES = ["Sigo en la tienda.", "Reviso unos pedidos.", "Trabajo un poco más."];

function pickFallback(lang: SellerLanguage, seed: string): string {
  const arr = lang === "en" ? PERSONAL_FALLBACK_EN : lang === "es" ? PERSONAL_FALLBACK_ES : PERSONAL_FALLBACK_FR;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length]!;
}

/**
 * Retire accueil / support si le prospect parle socialement (« tu fais quoi ? »).
 */
export function repairSocialSupportModeReply(args: {
  reply: string;
  userMessage: string;
  lang: SellerLanguage;
  agentName?: string | null;
}): string {
  const intent = detectSocialIntent(args.userMessage, { agentName: args.agentName });
  if (!intent.forbidSupportMode && intent.kind !== "personal_question") return args.reply;

  let out = String(args.reply ?? "").trim();
  if (!out) {
    if (intent.kind === "personal_question") return pickFallback(args.lang, args.userMessage);
    return out;
  }

  if (args.lang === "en") {
    out = out.replace(WELCOME_EN, "").replace(SUPPORT_EN, "");
  } else if (args.lang === "es") {
    out = out.replace(WELCOME_ES, "").replace(SUPPORT_ES, "");
  } else {
    out = out.replace(WELCOME_FR, "").replace(SUPPORT_FR, "");
  }

  out = out.replace(/\s{2,}/g, " ").replace(/^\s*[.,;]\s*/g, "").trim();

  if (intent.kind === "personal_question") {
    const stillBad =
      /\b(bienvenue|welcome|bienvenido|comment\s+puis|how\s+can\s+i\s+help)\b/i.test(out) || out.length < 8;
    if (stillBad) return pickFallback(args.lang, args.userMessage + (args.agentName ?? ""));
  }

  return out;
}
