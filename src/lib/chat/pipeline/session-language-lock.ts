import { detectConversationLanguage, type ConversationLanguage } from "@/lib/ai/language-detection";

/** Verrou langue session — évite fallbacks anglais sur fil français. */
export type SessionLanguageLock = {
  language: ConversationLanguage;
  locked: boolean;
  source: "message" | "history" | "state" | "default_fr";
};

const FRENCH_PARTICLES =
  /\b(je|j['']|tu|vous|nous|c['']est|c['']était|pas|plus|déjà|deja|hier|aujourd|demain|boutique|merci|bonjour|bonsoir|salut|chez|pour|avec|très|bien|mince|dommage|franchement|déçu|fermé|ferme|passé|passée|venu|venue)\b/i;

function messageLooksFrench(message: string): boolean {
  const m = String(message ?? "").trim();
  if (!m) return false;
  if (/[àâäéèêëïîôùûüçœæ]/i.test(m)) return true;
  return FRENCH_PARTICLES.test(m);
}

/**
 * Détecte et verrouille la langue du fil.
 * Priorité : signal fort du message > historique user > état persisté > français (marché FR).
 */
export function resolveSessionLanguageLock(args: {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  previous?: ConversationLanguage;
}): SessionLanguageLock {
  const detected = detectConversationLanguage({
    message: args.message,
    previous: args.previous,
    history: args.history,
  });

  if (messageLooksFrench(args.message)) {
    return { language: "fr", locked: true, source: "message" };
  }

  const userBlob = (args.history ?? [])
    .filter((h) => h.role === "user")
    .slice(-4)
    .map((h) => h.content)
    .join(" ");
  if (userBlob && messageLooksFrench(userBlob)) {
    return { language: "fr", locked: true, source: "history" };
  }

  if (args.previous === "fr" || args.previous === "en" || args.previous === "es") {
    return { language: args.previous, locked: true, source: "state" };
  }

  if (detected === "fr") {
    return { language: "fr", locked: true, source: "message" };
  }

  return { language: detected === "en" || detected === "es" ? detected : "fr", locked: false, source: "default_fr" };
}

/** Fallback professionnel verrouillé — jamais de mélange EN sur fil FR. */
export function lockedLanguageFallback(args: {
  lang: ConversationLanguage;
  businessName: string;
  agentName: string;
  kind: "greeting" | "empathy" | "hold" | "discovery";
}): string {
  const { lang, businessName, agentName } = args;
  if (args.kind === "empathy") {
    if (lang === "en") {
      return "I understand your frustration, and I'm sorry for the wasted trip. I'll check this right away and give you a clear answer.";
    }
    if (lang === "es") {
      return "Entiendo su frustración y lamento el desplazamiento. Voy a verificar esto de inmediato para darle una respuesta clara.";
    }
    return "Je comprends votre frustration et je suis désolée pour ce déplacement inutile. Je vais vérifier cela immédiatement afin de vous donner une réponse claire.";
  }
  if (args.kind === "greeting") {
    if (lang === "en") {
      return `Hello 🙂 Welcome to ${businessName}. How can I help you today?`;
    }
    if (lang === "es") {
      return `Hola 🙂 Bienvenido a ${businessName}. ¿En qué puedo ayudarle hoy?`;
    }
    return `Bonjour 🙂 Bienvenue chez ${businessName}. Comment puis-je vous aider aujourd'hui ?`;
  }
  if (args.kind === "hold") {
    if (lang === "en") return "One moment — I'm checking that for you.";
    if (lang === "es") return "Un momento — estoy verificando.";
    return "Un instant — je vérifie cela pour vous.";
  }
  if (lang === "en") return `I'm ${agentName} from ${businessName}. What can I help you with?`;
  if (lang === "es") return `Soy ${agentName} de ${businessName}. ¿En qué puedo ayudarle?`;
  return `Je suis ${agentName} chez ${businessName}. Comment puis-je vous aider ?`;
}
