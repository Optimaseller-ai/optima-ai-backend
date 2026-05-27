import { analyzeBuyingIntent } from "@/lib/agents/sales-intelligence/intent-analysis/buying-intent-engine";
import { assessConversationFatigue } from "@/lib/agents/sales-intelligence/conversation-guidance/conversation-fatigue";
import { inferSalesTemperature } from "@/lib/agents/sales-intelligence/sales-scoring/sales-temperature";
import type {
  LeadTemperature,
  ObjectionType,
  ProspectAnalysis,
  ProspectEmotion,
  PurchaseIntention,
  TrustLevel,
} from "@/lib/ai/sales/types";
import type { SalesDecisionInput } from "../types";
import { detectBrainObjections } from "../objection-handling/objection-detector";
import { analyzeProspectSilence } from "./silence-analyzer";

function mapTemperature(temp: string, intentScore: number): LeadTemperature {
  if (temp === "ready_to_buy" || temp === "customer" || intentScore >= 82) return "Hot";
  if (temp === "hot" || intentScore >= 68) return "Hot";
  if (temp === "warm" || intentScore >= 42) return "Warm";
  return "Cold";
}

function inferEmotion(message: string, fatigue01: number): ProspectEmotion {
  const m = String(message ?? "").toLowerCase();
  if (/\b(énerv|enerve|frustr|marre|ras le bol|nul|arnaque|scam|inadmissible)\b/i.test(m)) return "Frustrated";
  if (/\b(haha|mdr|lol|😂|🤣)\b/i.test(m) || /(^|\s)lol(\s|$)/i.test(m)) return "Joking";
  if (/\b(pas sûr|pas sur|hésit|hesit|peut[- ]?être|peut etre|je sais pas|bof)\b/i.test(m)) return "Hesitant";
  if (/\b(super|génial|genial|parfait|j'adore|top|🔥|yes+)\b/i.test(m)) return "Excited";
  if (/\b(vraiment|sérieux|serieux|preuve|garanti|pourquoi croire)\b/i.test(m)) return "Skeptical";
  if (fatigue01 > 0.55 && m.length < 28) return "Hesitant";
  return "Neutral";
}

function inferTrust(args: {
  objectionTypes: ObjectionType[];
  trustLevel01?: number;
  emotion: ProspectEmotion;
}): TrustLevel {
  if (args.emotion === "Frustrated" || args.objectionTypes.includes("TRUST")) return "Low";
  if (typeof args.trustLevel01 === "number") {
    if (args.trustLevel01 < 0.38) return "Low";
    if (args.trustLevel01 > 0.72) return "High";
  }
  if (args.objectionTypes.length >= 2) return "Low";
  if (args.emotion === "Skeptical") return "Low";
  if (args.emotion === "Excited") return "High";
  return "Medium";
}

function inferIntention(buyingScore: number, phase: string): PurchaseIntention {
  if (phase === "imminent_purchase" || buyingScore >= 82) return "High";
  if (phase === "purchase_intent" || buyingScore >= 62) return "High";
  if (phase === "real_interest" || phase === "comparison" || buyingScore >= 44) return "Medium";
  return "Low";
}

function computeConversionProbability(args: {
  temperature: LeadTemperature;
  intention: PurchaseIntention;
  trust: TrustLevel;
  fatigue01: number;
  objectionCount: number;
}): number {
  let p = 22;
  if (args.temperature === "Warm") p += 18;
  if (args.temperature === "Hot") p += 38;
  if (args.intention === "Medium") p += 12;
  if (args.intention === "High") p += 28;
  if (args.trust === "High") p += 14;
  if (args.trust === "Low") p -= 18;
  p -= Math.round(args.fatigue01 * 22);
  p -= args.objectionCount * 9;
  return Math.max(4, Math.min(96, p));
}

/** Analyse prospect multi-signaux (sans transcript brut obligatoire). */
export function analyzeProspectState(input: SalesDecisionInput): ProspectAnalysis & {
  buyingPhase: string;
  intentScore: number;
  silenceSuggestWait: boolean;
} {
  const message = String(input.message ?? "");
  const sellerIntent = input.sellerIntent ?? "other";
  const buying = analyzeBuyingIntent(message, sellerIntent);
  const turns = typeof input.stats?.turn_count === "number" ? input.stats.turn_count : 0;
  const temperatureSnap = inferSalesTemperature({
    buyingPhase: buying.phase,
    intentScore: buying.intentScore,
    conversationProfile: input.conversationProfile,
    turnCount: turns,
  });
  const fatigue = assessConversationFatigue({
    turnCount: turns,
    behavioralFatigue01: typeof input.stats?.fatigue === "number" ? input.stats.fatigue : 0,
  });
  const objections = detectBrainObjections(message, input.commercialMemory?.objections);
  const objectionTypes = objections.map((o) => o.type).filter((t) => t !== "NONE");
  const emotion = inferEmotion(message, fatigue.fatigueScore01);
  const temperature = mapTemperature(temperatureSnap.temperature, buying.intentScore);
  const trust = inferTrust({
    objectionTypes,
    trustLevel01: input.salesSignalsMemory?.trustLevel01,
    emotion,
  });
  const intention = inferIntention(buying.intentScore, buying.phase);
  const silence = analyzeProspectSilence({
    silenceMs: input.silenceMs,
    lastActiveAt: input.stats?.last_active_at,
  });

  const conversionProbability = computeConversionProbability({
    temperature,
    intention,
    trust,
    fatigue01: fatigue.fatigueScore01,
    objectionCount: objectionTypes.length,
  });

  return {
    temperature,
    emotion,
    trust,
    intention,
    activeObjections: objectionTypes.length ? objectionTypes : ["NONE"],
    conversationFatigue: fatigue.fatigueScore01,
    conversionProbability,
    suggestedStrategy: "SOFT_CONVERSATION",
    reasoning: "",
    buyingPhase: buying.phase,
    intentScore: buying.intentScore,
    silenceSuggestWait: silence.suggestFollowupWait,
  };
}
