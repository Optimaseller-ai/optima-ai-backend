import { detectProspectEffort } from "../human-behavior/effort-detection";

export type ConversationEmotionalState =
  | "neutral"
  | "interested"
  | "buying"
  | "confused"
  | "frustrated"
  | "angry";

export type EmotionalContinuityMemory = {
  state: ConversationEmotionalState;
  frustration_score: number;
  visit_complaint_count?: number;
  last_complaint_at?: number;
  abandonment_risk?: number;
  updatedAt?: number;
};

export type ConversationEmotionProfile = {
  state: ConversationEmotionalState;
  frustration_score: number;
  is_complaint: boolean;
  is_buying_intent: boolean;
  blocks_social_quick: boolean;
  requires_empathy: boolean;
  requires_business_resolution: boolean;
};

const COMPLAINT =
  /\b(plainte|réclamation|reclamation|insatisfait|déçu|decu|dommage|mince|pas\s+content|pas\s+trouvé|pas\s+trouvée|fermé|ferme|fermée|c['']était\s+fermé|inadmissible|arnaque|honte)\b/i;

const FRUSTRATION =
  /\b(franchement|marre|énerv|enerve|frustr|déjà\s+\d|deja\s+\d|encore\s+une\s+fois|2\s+fois|deux\s+fois|toujours\s+pas|déplacement\s+inutile|inutile\s+de\s+me\s+déplacer)\b/i;

const ANGER = /\b(scandale|inacceptable|honteux|nul|ridicule|tribunal|police|menace)\b/i;

const BUYING =
  /\b(je\s+veux\s+acheter|je\s+commande|je\s+prends|passer\s+commande|i\s+want\s+to\s+buy|quiero\s+comprar|prêt\s+à\s+payer)\b/i;

const INTERESTED = /\b(intéressé|interesse|je\s+cherche|besoin\s+d['']?un|quel\s+modèle|combien\s+ça\s+coûte)\b/i;

const CONFUSED = /\b(pas\s+clair|je\s+comprends\s+pas|expliquez|confus)\b/i;

export function classifyConversationEmotion(args: {
  message: string;
  previous?: EmotionalContinuityMemory;
}): ConversationEmotionProfile {
  const m = String(args.message ?? "").trim();
  const lower = m.toLowerCase();
  const effort = detectProspectEffort(m);
  const prevScore = args.previous?.frustration_score ?? 0;
  const prevVisits = args.previous?.visit_complaint_count ?? 0;

  let frustration_score = prevScore;
  if (FRUSTRATION.test(lower)) frustration_score = Math.max(frustration_score, 0.72);
  if (COMPLAINT.test(lower) || effort.effort_detected) frustration_score = Math.max(frustration_score, 0.58);
  if (ANGER.test(lower)) frustration_score = Math.max(frustration_score, 0.88);
  if (/\b(déjà|deja)\s+\d\s+fois\b/i.test(lower)) frustration_score = Math.max(frustration_score, 0.8);

  const repeatVisit = effort.effort_detected || /\b(passé|passée|venu|venue|boutique|déplacé)\b/i.test(lower);
  if (repeatVisit && (prevVisits >= 1 || FRUSTRATION.test(lower))) {
    frustration_score = Math.max(frustration_score, 0.85);
  }

  const is_complaint =
    COMPLAINT.test(lower) || effort.effort_detected || frustration_score >= 0.55;
  const is_buying_intent = BUYING.test(lower);
  const requires_empathy = is_complaint || frustration_score >= 0.5 || ANGER.test(lower);
  const requires_business_resolution = is_complaint || effort.effort_detected;

  let state: ConversationEmotionalState = "neutral";
  if (ANGER.test(lower) || frustration_score >= 0.82) state = "angry";
  else if (frustration_score >= 0.55 || is_complaint) state = "frustrated";
  else if (is_buying_intent) state = "buying";
  else if (INTERESTED.test(lower)) state = "interested";
  else if (CONFUSED.test(lower)) state = "confused";

  const blocks_social_quick =
    requires_empathy ||
    requires_business_resolution ||
    is_buying_intent ||
    state === "confused" ||
    state === "frustrated" ||
    state === "angry" ||
    m.length > 28;

  return {
    state,
    frustration_score,
    is_complaint,
    is_buying_intent,
    blocks_social_quick,
    requires_empathy,
    requires_business_resolution,
  };
}

export function mergeEmotionalContinuity(
  prev: EmotionalContinuityMemory | undefined,
  profile: ConversationEmotionProfile,
  message: string,
): EmotionalContinuityMemory {
  const effort = detectProspectEffort(message);
  const visitBump = effort.effort_detected || profile.is_complaint ? 1 : 0;
  return {
    state: profile.state,
    frustration_score: profile.frustration_score,
    visit_complaint_count: (prev?.visit_complaint_count ?? 0) + visitBump,
    last_complaint_at: profile.is_complaint ? Date.now() : prev?.last_complaint_at,
    abandonment_risk: Math.min(1, profile.frustration_score + (prev?.visit_complaint_count ?? 0) * 0.08),
    updatedAt: Date.now(),
  };
}

export function buildEmotionalPriorityReply(args: {
  profile: ConversationEmotionProfile;
  lang: "fr" | "en" | "es";
  businessName: string;
  agentName: string;
  message: string;
}): string | null {
  if (!args.profile.requires_empathy && !args.profile.requires_business_resolution) return null;

  const effort = detectProspectEffort(args.message);
  if (effort.effort_detected) {
    if (args.lang === "en") {
      return `I'm really sorry you came by and we were closed 😕 That's frustrating. I'll check the best time for you to visit so you don't waste another trip.`;
    }
    if (args.lang === "es") {
      return `Lamento mucho que haya ido y estuviéramos cerrados 😕 Entiendo la molestia. Voy a verificar el mejor horario para que no pierda otro desplazamiento.`;
    }
    return `Je suis vraiment désolée que vous soyez passé et que ce soit fermé 😕 Je comprends que c'est frustrant. Je vérifie tout de suite le meilleur moment pour vous éviter un autre déplacement inutile.`;
  }

  if (args.profile.frustration_score >= 0.75) {
    if (args.lang === "en") {
      return `I understand your frustration, and I'm sorry about the trouble. I'll look into this right away and get back to you with a clear answer.`;
    }
    if (args.lang === "es") {
      return `Entiendo su frustración y lamento las molestias. Voy a revisar esto de inmediato y le daré una respuesta clara.`;
    }
    return `Je comprends votre frustration et je suis désolée pour ce déplacement inutile. Je vais vérifier cela immédiatement afin de vous donner une réponse claire.`;
  }

  if (args.profile.is_complaint) {
    if (args.lang === "en") {
      return `I'm sorry about that experience. I'm checking with the team so we can fix this properly — one moment.`;
    }
    if (args.lang === "es") {
      return `Lamento esa experiencia. Estoy verificando con el equipo para resolverlo correctamente.`;
    }
    return `Je suis désolée pour cette expérience. Je vérifie avec l'équipe pour vous répondre clairement — un instant.`;
  }

  return null;
}
