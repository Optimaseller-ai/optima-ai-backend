import type { QuestionBudget, TurnKind } from "./pipeline/pipeline-types";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function inferTurnKind(message: string): TurnKind {
  const m = String(message ?? "").trim();
  if (!m) return "unknown";
  const lower = m.toLowerCase();
  if (/^(salut|bonjour|bonsoir|cc|coucou)\b/.test(lower)) return "greeting";
  if (/^(ok|oui|non|ça marche|d'accord|merci)\b/.test(lower)) return "simple_ack";
  if (/[?？]/.test(m)) return "question";
  if (/\b(trop cher|cher|prix|remise|promo|réduction)\b/.test(lower)) return "objection";
  if (/\b(rembour|retour|sav|problème|bug|cassé|pas reçu|livraison)\b/.test(lower)) return "complaint";
  if (/\b(j’achète|j'achète|je prends|commande|payer|paiement|lien|dispo)\b/.test(lower)) return "purchase_intent";
  if (m.length <= 18) return "simple_ack";
  return "info_clear";
}

export function computeQuestionBudget(input: {
  message: string;
  turnCount?: number;
  energy?: string;
  emotionLabel?: string;
  seed?: string;
}): { turnKind: TurnKind; budget: QuestionBudget } {
  const turnKind = inferTurnKind(input.message);
  const turnCount = input.turnCount ?? 0;
  const emo = String(input.emotionLabel ?? "").toLowerCase();
  const isFrustrated = /frustr|anger|irrit|plainte|complaint/.test(emo);
  const isGreeting = turnKind === "greeting";
  const isSimple = turnKind === "simple_ack" || turnKind === "info_clear";

  // Base probabilities tuned for “balanced seller” WhatsApp feel.
  let p = 0.35;
  if (isGreeting) p = 0.55;
  if (isSimple) p = 0.1;
  if (turnKind === "complaint") p = 0.2;
  if (turnKind === "objection") p = 0.25;
  if (turnKind === "purchase_intent") p = 0.3;
  if (isFrustrated) p *= 0.55;
  if (turnCount <= 1) p += 0.1;

  // Deterministic-ish roll if seed provided, else Math.random.
  let roll = Math.random();
  if (input.seed) {
    let h = 2166136261 >>> 0;
    const s = `${input.seed}|qprob|${turnKind}`;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    roll = (h % 10_000) / 10_000;
  }

  p = clamp01(p);

  // Rules enforcement
  const maxQuestions: 0 | 1 = isGreeting ? 1 : 1;
  const askQuestion =
    isSimple ? false : // simple reply -> none
    turnKind === "info_clear" ? false : // clear info -> affirmation only
    roll < p;

  const reason = isSimple
    ? "rule_simple_reply_no_question"
    : turnKind === "info_clear"
      ? "rule_clear_info_affirm_only"
      : isFrustrated
        ? "frustration_reduce_questions"
        : isGreeting
          ? "greeting_allows_one_question"
          : "probabilistic";

  return {
    turnKind,
    budget: {
      askQuestion,
      maxQuestions: askQuestion ? maxQuestions : 0,
      roll,
      reason,
    },
  };
}

