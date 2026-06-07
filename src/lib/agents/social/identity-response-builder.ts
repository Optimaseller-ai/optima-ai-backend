import "server-only";

import { getCommercialAgentById, resolveCommercialAgentKey } from "@/lib/agents/personality/commercial-agents";

type IdentityInput = {
  agentName: string;
  businessName: string;
  personaKey?: string | null;
  lang?: "fr" | "en" | "es";
  allowEmoji?: boolean;
};

/**
 * Construit une réponse identité dynamique selon le rôle, le style commercial
 * et la personnalité de l'agent.
 *
 * Diane (premium) → "Je suis Diane, je m'occupe du service premium chez Yuri Telecom."
 * Axel (conseiller) → "Je suis Axel, je vous accompagne pour les commandes chez Yuri Telecom 🙂"
 * Samuel (technique) → "Je suis Samuel du support technique Yuri Telecom."
 */
export function buildIdentityResponse(input: IdentityInput): string {
  const { agentName, businessName, personaKey, lang = "fr", allowEmoji = true } = input;
  const name = agentName || "Conseiller";
  const biz = businessName || "notre boutique";
  const smile = allowEmoji ? " 🙂" : "";

  const resolvedKey = resolveCommercialAgentKey(personaKey);
  const agentDef = resolvedKey ? getCommercialAgentById(resolvedKey) : null;

  const role = agentDef?.role ?? "Service client";
  const salesStyle = agentDef?.salesStyle ?? "conseiller";

  const fingerprint = computeIdentityStyleFingerprint(resolvedKey ?? "default");
  const styleIndex = fingerprint % 6;

  const roleIntro = buildRoleIntroFr(role, salesStyle, styleIndex);

  if (lang === "en") {
    const enStyles = [
      `I'm ${name} from ${biz} — ${roleIntroEn(salesStyle, role)}`,
      `I work at ${biz}, ${roleIntroEn(salesStyle, role)}. I'm ${name}${smile}`,
      `${name} here — ${roleIntroEn(salesStyle, role)} at ${biz}${smile}`,
    ];
    return enStyles[styleIndex % enStyles.length]!;
  }

  if (lang === "es") {
    const esStyles = [
      `Soy ${name}, ${roleIntroEs(role, salesStyle)} de ${biz}${smile}`,
      `Mi nombre es ${name}, ${roleIntroEs(role, salesStyle)} en ${biz}${smile}`,
    ];
    return esStyles[styleIndex % esStyles.length]!;
  }

  const frStyles = [
    `Je suis ${name}, ${roleIntro}`,
    `Je m'appelle ${name}, ${roleIntro}`,
    `${name} — ${roleIntro}`,
  ];
  return frStyles[styleIndex % frStyles.length]!;
}

function buildRoleIntroFr(
  role: string,
  salesStyle: string,
  styleIndex: number,
): string {
  const lowerRole = role.toLowerCase();

  if (/premium|service\s+client|relation\s+client/.test(lowerRole)) {
    const pool = [
      `je m'occupe du ${lowerRole} chez`,
      `je suis votre conseillère pour le ${lowerRole} chez`,
      `je gère le ${lowerRole} chez`,
    ];
    return pool[styleIndex % pool.length]!;
  }

  if (/commandes|support|technique/.test(lowerRole)) {
    const pool = [
      `je vous accompagne pour ${lowerRole} chez`,
      `je suis là pour le ${lowerRole} chez`,
      `je gère le ${lowerRole} chez`,
    ];
    return pool[styleIndex % pool.length]!;
  }

  if (/conseill?er/.test(lowerRole)) {
    const pool = [
      `je suis votre ${lowerRole} chez`,
      `je vous accompagne chez`,
      `${lowerRole} chez`,
    ];
    return pool[styleIndex % pool.length]!;
  }

  if (salesStyle === "premium") {
    const pool = [
      `je suis votre conseillère attitrée chez`,
      `je gère le service premium chez`,
    ];
    return pool[styleIndex % pool.length]!;
  }

  if (salesStyle === "conseiller") {
    const pool = [
      `je vous accompagne pour vos achats chez`,
      `je suis là pour vous aider chez`,
    ];
    return pool[styleIndex % pool.length]!;
  }

  return `du service ${lowerRole} chez`;
}

function roleIntroEn(salesStyle: string, role: string): string {
  const lowerRole = role.toLowerCase();
  if (/support|technique/.test(lowerRole)) return `I handle ${lowerRole}`;
  if (/premium/.test(lowerRole) || salesStyle === "premium") return `I handle premium service`;
  if (/conseill?er|commande/.test(lowerRole)) return `I help with orders and inquiries`;
  return `I'm on the customer service team`;
}

function roleIntroEs(role: string, _salesStyle: string): string {
  const lowerRole = role.toLowerCase();
  if (/premium/.test(lowerRole)) return `encargada del servicio premium`;
  if (/conseill?er/.test(lowerRole)) return `su asesora comercial`;
  if (/commandes|support/.test(lowerRole)) return `encargada de pedidos y soporte`;
  return `del servicio al cliente`;
}

/**
 * Calcule une empreinte déterministe unique pour chaque agent.
 * Garantit que Diane, Axel et Samuel génèrent des formulations différentes.
 */
export function computeIdentityStyleFingerprint(personaKey: string): number {
  const payload = personaKey.toLowerCase().trim();
  let h = 2166136261 >>> 0;
  for (let i = 0; i < payload.length; i++) {
    h = Math.imul(h ^ payload.charCodeAt(i), 16777619) >>> 0;
  }
  console.log("[IDENTITY_FINGERPRINT]", { personaKey, fingerprint: h });
  return h;
}

/**
 * Valide qu'une réponse sociale est suffisamment textuelle.
 * Règles :
 * - minimum 3 caractères textuels (après stripping emoji/punct)
 * - pas de réponse composée uniquement d'emoji, ponctuation, "ok", "oui", "non"
 */
export function isValidSocialReply(reply: string): boolean {
  const text = String(reply ?? "").trim();
  if (!text) return false;

  const stripped = text
    .replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped) return false;
  if (stripped.length < 3) return false;

  const lower = stripped.toLowerCase();
  const bannedExact = /^(ok|oui|non|si|d'accord|dac|voilà|voila|bon|bien|ouais|nan|super|cool|parfait|d'accord|merci|salut|bonjour|bonsoir|cc|hey|hi|bye|fait|vrai|non merci|oui merci)$/i;
  if (bannedExact.test(lower)) return false;

  return true;
}

/**
 * Remplace une réponse sociale invalide par un fallback valide.
 */
export function repairSocialReply(reply: string, lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    return "Got it, thanks 🙂";
  }
  if (lang === "es") {
    return "Entendido, gracias 🙂";
  }
  const pool = [
    "Je vois 😄",
    "Ça marche 🙂",
    "Bien reçu",
    "D'accord, je vois 🙂",
  ];
  const h = String(reply ?? "").length;
  return pool[h % pool.length]!;
}
