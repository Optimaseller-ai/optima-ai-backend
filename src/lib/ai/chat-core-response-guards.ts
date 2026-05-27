import type { BusinessProfile } from "./whoami";

const AI_TONE_BLACKLIST = [
  "Je suis là pour vous aider",
  "Je suis ici pour vous aider",
  "Je suis là pour t'aider",
  "Je suis ici pour t'aider",
  "Je peux vous aider",
  "Je peux t'aider",
  "Puis-je vous aider",
  "Puis-je t'aider",
  "Comment puis-je vous aider",
  "Comment puis-je t'aider",
  "Comment puis-je vous assister",
  "Comment puis-je t'assister",
  "Que puis-je faire pour vous",
  "Que puis-je faire pour toi",
  "Je comprends",
  "Je comprend",
  "Je sais que",
  "Je vois que",
  "Je remarque que",
  "Pas de souci",
  "Pas de problème",
  "C'est pas grave",
  "T'inquiète pas",
  "Vous inquiétez pas",
  "Pas d'inquiétude",
  "Cherchez-vous",
  "Tu cherches",
  "Vous cherchez",
  "Tu cherches des",
  "Vous cherchez des",
  "Que cherchez-vous",
  "Qu'est-ce que tu cherches",
  "N'hésitez pas",
  "N'hésite pas",
  "N'hésite pas à",
  "N'hésitez pas à",
  "N'hésite pas de",
  "N'hésitez pas de",
  "Faites-moi savoir",
  "Fais-moi savoir",
  "Laissez-moi savoir",
  "Laisse-moi savoir",
  "Je serais heureux",
  "Je serais heureuse",
  "Je serais ravi",
  "Je serais ravie",
  "Je serais enchanté",
  "Je suis une IA",
  "Je suis un chatbot",
  "Je suis une intelligence artificielle",
  "Je suis juste une IA",
  "Je suis un assistant",
  "Je suis votre assistant",
  "Je suis ton assistant",
  "Comme un assistant IA",
  "En tant qu'IA",
  "En tant qu'assistant",
  "Si vous avez des questions",
  "Si tu as des questions",
  "Si vous avez besoin",
  "Si tu as besoin",
  "Avez-vous d'autres questions",
  "As-tu d'autres questions",
  "Avez-vous d'autres besoins",
  "As-tu d'autres besoins",
  "Je suis désolé",
  "Je suis désolée",
  "Désolé",
  "Je peux vous assister",
  "Avez-vous besoin d'autre chose",
  "Avez-vous besoin d’autre chose",
  "Je reste disponible",
  "Je reste à votre disposition",
  "Je vais faire de mon mieux",
  "Tu cherches des informations",
  "Tu cherches des infos",
];

const HUMAN_REPLY_LIBRARY = {
  greeting: [
    "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
    "Bonjour, bienvenue ! Que puis-je faire pour vous ?",
    "Salut ! Vous cherchez quelque chose en particulier ?",
  ],
  thanks: ["Je vous en prie !", "Avec plaisir !", "C'était naturel !"],
  ok: ["Parfait !", "D'accord !", "Très bien !"],
  howAreYou: [
    "Je vais très bien, merci ! Et vous ?",
    "Ça va bien, merci de demander ! Et toi ?",
    "Je suis en forme ! Et toi, ça va ?",
  ],
  unknownInfo: [
    "Je n’ai pas encore cette information précise.",
    "Je ne dispose pas de ces détails pour le moment.",
    "Cette information n'est pas encore dans notre système.",
    "Je vous suggère de vérifier directement auprès du service concerné.",
  ],
  cantHelp: [
    "Je comprends votre situation.",
    "Désolé pour ce contretemps.",
    "Je vais faire de mon mieux pour vous aider autrement.",
    "Souhaitez-vous que je vous transfère vers quelqu'un qui peut mieux vous aider ?",
  ],
  professionalClosing: [
    "N’hésitez pas si vous avez besoin d’autre chose.",
    "Je reste disponible pour vous aider.",
    "Vous pouvez aussi repasser plus tard.",
    "D’accord, je vous attends pour la suite.",
  ],
} as const;

export type HumanReplyCategory = keyof typeof HUMAN_REPLY_LIBRARY;

export type AntiAssumptionContext = {
  businessProfile: BusinessProfile | null;
  hasVerifiedHours: boolean;
  hasVerifiedInfo: boolean;
  userMessage: string;
};

export type TrustScoreContext = {
  businessProfile: BusinessProfile | null;
  hasVerifiedHours: boolean;
  hasVerifiedInfo: boolean;
  userAskedAboutHours: boolean;
  userAskedAboutInfo: string[];
};

const ASSUMPTION_PATTERNS = [
  /peux?-t[ée]?/i,
  /s[ûu]rement/i,
  /probablement/i,
  /il devait/i,
  /elle devait/i,
  /sans doute/i,
  /d'après ce que je sais/i,
  /je pense que/i,
  /il semble que/i,
  /elle semble que/i,
  /apparemment/i,
  /il paraît que/i,
];

const FLOATING_ACTION_PATTERNS = [
  /je vais vérifier/i,
  /je regarde/i,
  /je confirme/i,
  /un instant/i,
  /je vais voir/i,
  /je vais demander/i,
  /je vais regarder/i,
  /je vais confirmer/i,
  /je vais voir ce que/i,
  /je vais appeler/i,
  /je vais consulter/i,
];

const HONESTY_PATTERNS = [
  /je n'ai pas/i,
  /je ne dispose pas/i,
  /cette information n'est pas/i,
  /je ne sais pas/i,
  /je ne connais pas/i,
  /pas encore dans notre système/i,
];

const HUMAN_BONUS_PATTERNS = [
  /n.hésitez pas/i,
  /je reste disponible/i,
  /repasser plus tard/i,
  /d’accord.*je vous attends/i,
  /je comprends/i,
  /désolé/i,
  /je vais faire de mon mieux/i,
];

export function cleanAITone(text: string, preserveFacts = false): string {
  if (preserveFacts) {
    let cleaned = text
      .replace(/  +/g, " ")
      .replace(/\t+/g, " ")
      .replace(/\n\s*\n\s*\n+/g, "\n\n")
      .trim();
    cleaned = cleaned.replace(/\s*\?\s*$/, "").trim();
    return cleaned
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .join("\n");
  }

  let cleaned = text;
  for (const phrase of AI_TONE_BLACKLIST) {
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    cleaned = cleaned.replace(regex, "");
  }

  cleaned = cleaned
    .replace(/  +/g, " ")
    .replace(/\t+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim()
    .replace(/\s*\?\s*$/, "")
    .trim();

  return cleaned
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

export function applyAntiAssumptionGuard(text: string, context: AntiAssumptionContext): string {
  const hasAssumption = ASSUMPTION_PATTERNS.some((p) => p.test(text));
  const hasFloatingAction = FLOATING_ACTION_PATTERNS.some((p) => p.test(text));

  if (!hasAssumption && !hasFloatingAction) return text;

  if (/heure|ouverture|fermeture|horaires/i.test(text) && context.hasVerifiedHours === false) {
    return "Je n’ai pas encore les horaires exacts de la boutique. Je vous conseille de contacter directement le responsable avant de vous déplacer.";
  }

  const safeResponses = [
    "Je comprends votre situation.",
    "Désolé pour ce contretemps.",
    "Je vais faire de mon mieux pour vous aider.",
    "Souhaitez-vous que je vous aide autrement ?",
    "Pouvez-vous me préciser votre demande ?",
    "Je reste à votre disposition pour toute assistance.",
  ];

  return safeResponses[Math.floor(Math.random() * safeResponses.length)]!;
}

export function getHumanReply(category: string): string {
  const replies = HUMAN_REPLY_LIBRARY[category as HumanReplyCategory];
  if (replies && replies.length > 0) {
    return replies[Math.floor(Math.random() * replies.length)]!;
  }
  return "Je comprends votre demande.";
}

export function calculateTrustScore(response: string, context: TrustScoreContext): number {
  let score = 100;

  for (const pattern of ASSUMPTION_PATTERNS) {
    if (pattern.test(response)) score -= 25;
  }

  for (const pattern of FLOATING_ACTION_PATTERNS) {
    if (pattern.test(response)) score -= 30;
  }

  if (
    context.userAskedAboutHours &&
    context.hasVerifiedHours === false &&
    /je vais vérifier|je regarde|je confirme|un instant|je sais|je connais/i.test(response)
  ) {
    score -= 35;
  }

  for (const _infoType of context.userAskedAboutInfo) {
    if (!context.hasVerifiedInfo && /je vais vérifier|je regarde|je confirme|un instant|je sais|je connais/i.test(response)) {
      score -= 25;
    }
  }

  for (const pattern of HUMAN_BONUS_PATTERNS) {
    if (pattern.test(response)) score += 15;
  }

  for (const pattern of HONESTY_PATTERNS) {
    if (pattern.test(response)) score += 20;
  }

  return Math.max(0, Math.min(100, score));
}

export function pickHumanReplyForUserMessage(userMessage: string): string {
  if (/heure|ouverture|fermeture|horaires/i.test(userMessage)) return getHumanReply("unknownInfo");
  if (/merci|thank you/i.test(userMessage)) return getHumanReply("thanks");
  if (/bonjour|salut/i.test(userMessage)) return getHumanReply("greeting");
  if (/ok|d'accord/i.test(userMessage)) return getHumanReply("ok");
  if (/ça va|how are you/i.test(userMessage)) return getHumanReply("howAreYou");
  return getHumanReply("cantHelp");
}

export function guardAndScoreReply(args: {
  message: string;
  userMessage: string;
  businessProfile: BusinessProfile | null;
}): string {
  const guardContext: AntiAssumptionContext = {
    businessProfile: args.businessProfile,
    hasVerifiedHours: false,
    hasVerifiedInfo: Boolean(args.businessProfile),
    userMessage: args.userMessage,
  };

  let guarded = applyAntiAssumptionGuard(cleanAITone(args.message, false), guardContext);

  const trustScore = calculateTrustScore(guarded, {
    businessProfile: args.businessProfile,
    hasVerifiedHours: false,
    hasVerifiedInfo: Boolean(args.businessProfile),
    userAskedAboutHours: /heure|ouverture|fermeture|horaires/i.test(args.userMessage),
    userAskedAboutInfo: [],
  });

  if (trustScore < 60) {
    guarded = pickHumanReplyForUserMessage(args.userMessage);
  }

  return guarded;
}
