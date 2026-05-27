/**
 * Response Orchestrator — ProspectTurnIntent, détection & orchestration réponse humaine.
 */

export type ProspectTurnIntent =
  | "salutation"
  | "demande_horaires"
  | "demande_produit"
  | "achat"
  | "objection"
  | "plainte"
  | "effort_visite"
  | "simple_discussion"
  | "question_personnelle"
  | "confusion"
  | "absence"
  | "relance"
  | "wellbeing";

// ── Patterns de détection ───────────────────────────────────────────────────

const GREETING_RE = /^(bonjour|bonsoir|salut|hello|hi|hey|coucou|bonne?\s+journ|slt)\b/i;
const HOURS_RE = /\b(horaire|horaires|[aà]\s+quelle\s+heure|quelle\s+heure|passer\s+[aà]\s+quelle|ouvert|ferme|opening)/i;
const PRODUCT_RE = /\b(prix|tarif|combien|co[uû]t|produit|article|mod[eè]le|catalogue|iphone|samsung|acheter|commander|stock|dispo)\b/i;
const BUY_RE = /\b(je\s+prends|je\s+commande|je\s+valide|je\s+paie|je\s+veux\s+acheter|commander\s+maintenant)\b/i;
const OBJECTION_RE = /\b(c'est\s+trop\s+cher|trop\s+cher|h[eé]site|pas\s+s[uû]r|pas\s+encore|voir\s+plus\s+tard|r[eé]fl[eé]chir)\b/i;
const COMPLAINT_RE = /\b(plainte|arnaque|scam|honte|inadmissible|nul|marre|pas\s+normal|r[eé]clamation|d[eé][çc]u)\b/i;
const EFFORT_RE = /\b(boutique|magasin|je\s+suis\s+pass[eé]|j['']?[eé]tais|pas\s+trouv[eé]|attendu|ferm[eé]|yuri|responsable)\b/i;
const SOCIAL_RE = /\b([çc]a\s+va|comment\s+tu\s+vas|quoi\s+de\s+neuf|tu\s+fais\s+quoi|bonne\s+journ[eé]e)\b/i;
const PERSONAL_RE = /\b(tu\s+t['']appelles|vous\s+vous\s+appelez|ton\s+pr[eé]nom|c'est\s+quoi\s+ton\s+nom|vous\s+[êe]tes\s+qui)\b/i;
const WELLBEING_RE = /\b(malade|fatigue|triste|d[eé]prim|stress|probl[eè]me\s+perso|divorce|accident)\b/i;

export function detectProspectTurnIntent(message: string): ProspectTurnIntent {
  const m = String(message ?? "").trim();
  if (!m) return "simple_discussion";

  if (GREETING_RE.test(m) && m.length < 40) return "salutation";
  if (WELLBEING_RE.test(m)) return "wellbeing";
  if (COMPLAINT_RE.test(m)) return "plainte";
  if (EFFORT_RE.test(m) && (/\b(pas\s+trouv[eé]|attendu|ferm[eé]|absent)\b/i.test(m) || /\b(yuri|responsable|boss)\b/i.test(m))) {
    return "effort_visite";
  }
  if (HOURS_RE.test(m) && !PRODUCT_RE.test(m)) return "demande_horaires";
  if (BUY_RE.test(m)) return "achat";
  if (OBJECTION_RE.test(m)) return "objection";
  if (PRODUCT_RE.test(m)) return "demande_produit";
  if (PERSONAL_RE.test(m)) return "question_personnelle";
  if (SOCIAL_RE.test(m)) return "simple_discussion";

  return "simple_discussion";
}

export function salesOpportunityAllowedForIntent(intent: ProspectTurnIntent): boolean {
  const blocked: ProspectTurnIntent[] = [
    "salutation",
    "plainte",
    "effort_visite",
    "demande_horaires",
    "wellbeing",
    "question_personnelle",
    "confusion",
    "absence",
  ];
  return !blocked.includes(intent);
}

export function isPersonalWellbeingTurn(message: string): boolean {
  return WELLBEING_RE.test(message) || SOCIAL_RE.test(message);
}

export function buildPersonalWellbeingQuickReply(args: {
  message: string;
  lang: "fr" | "en" | "es";
  agentName?: string;
  businessName?: string;
  prospectProfile?: import("@/lib/agents/memory/prospect-profile").ProspectProfile;
}): string | null {
  if (!isPersonalWellbeingTurn(args.message)) return null;
  if (args.lang === "en") return "Hey, how's it going? 😊 Feel free to ask me anything.";
  if (args.lang === "es") return "¡Hola! ¿Cómo estás? 😊 Aquí para ayudarte.";
  return "Hey, ça va ? 😊 Dis-moi ce que je peux faire pour toi.";
}

export function formatTurnIntentOrchestratorBlock(intent: ProspectTurnIntent, lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    const map: Record<ProspectTurnIntent, string> = {
      salutation: "Greeting — warm welcome, no immediate push.",
      demande_horaires: "Hours request — give clear schedule, no fake checking.",
      demande_produit: "Product inquiry — one relevant hint.",
      achat: "Purchase signal — guide to next clear step.",
      objection: "Objection — reassure calmly.",
      plainte: "Complaint — listen, acknowledge, no sales push yet.",
      effort_visite: "Visited store — acknowledge effort, propose slot.",
      simple_discussion: "Small talk — human presence, not salesperson.",
      question_personnelle: "Personal question — brief honest reply.",
      confusion: "Confusion — clarify gently.",
      absence: "Absence — polite follow-up.",
      relance: "Follow-up — soft re-engagement.",
      wellbeing: "Wellbeing — empathy first.",
    };
    return `TURN_INTENT: ${map[intent] ?? intent}`;
  }
  const fr: Record<ProspectTurnIntent, string> = {
    salutation: "Salutation — accueil chaleureux, pas de push immédiat.",
    demande_horaires: "Demande horaires — donner horaires directs, pas de fausse vérif.",
    demande_produit: "Demande produit — une piste pertinente.",
    achat: "Signal achat — guider vers étape suivante.",
    objection: "Objection — rassurer calmement.",
    plainte: "Plainte — écouter, reconnaître, pas de vente.",
    effort_visite: "Visite boutique — reconnaître l'effort, proposer créneau.",
    simple_discussion: "Discussion — présence humaine, pas vendeur.",
    question_personnelle: "Question perso — réponse brève honnête.",
    confusion: "Confusion — clarifier doucement.",
    absence: "Absence — relance polie.",
    relance: "Relance — ré-engagement doux.",
    wellbeing: "Bien-être — empathie d'abord.",
  };
  return `INTENTION_TOUR : ${fr[intent] ?? intent}`;
}

// ── Orchestration réponse ─────────────────────────────────────────────────

export type OrchestrateHumanReplyInput = {
  lastUserMessage: string;
  draftText: string;
  microSeed?: string;
  repliesSinceLastEmoji?: number;
  stateLanguage?: string;
};

export type OrchestrateHumanReplyResult = {
  text: string;
  messagePlan: string[];
};

export function orchestrateHumanReply(input: OrchestrateHumanReplyInput): OrchestrateHumanReplyResult {
  const text = String(input.draftText ?? "").trim();
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Découpe douce si > 2 lignes ou > 300 chars
  const messagePlan: string[] = lines.length > 2 && text.length > 300 ? lines.slice(0, 3) : [];

  return { text, messagePlan };
}
