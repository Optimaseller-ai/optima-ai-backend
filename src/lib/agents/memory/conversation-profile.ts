import type {
  ConversationProfile,
  InterestLevel,
  LanguageStylePreference,
  ProspectTone,
  SellerIntent,
} from "@/lib/agents/memory/conversation-state";
import { DEFAULT_CONVERSATION_PROFILE } from "@/lib/agents/memory/conversation-state";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function uniqCap(arr: string[], max: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const t = x.trim();
    if (!t || t.length > 80 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Extrait un nom de produit naïf (complément à la mémoire catalogue côté prompt). */
export function extractProductHintsFromMessage(message: string): string[] {
  const m = String(message ?? "").trim();
  if (m.length < 3 || m.length > 200) return [];
  const out: string[] = [];
  const q = m.match(/["«]([^"»]{2,60})["»]/);
  if (q?.[1]) out.push(q[1].trim());
  const brandish = m.match(/\b(Nike|Adidas|Puma|Samsung|Apple|Huawei|Sony|LG|HP|Dell)\s+[\w\-]{2,40}/i);
  if (brandish?.[0]) out.push(brandish[0].trim());
  const colorPiece = m.match(
    /\b(chaussures?|baskets?|sandales?|sacs?|montres?)\b[^.!?]{0,40}\b(noir|noire|blanc|blanche|bleu|bleue|rouge)\b/i,
  );
  if (colorPiece?.[0]) out.push(colorPiece[0].trim().replace(/\s+/g, " "));
  return uniqCap(out, 4);
}

function inferProspectTone(message: string, prev: ProspectTone): ProspectTone {
  const t = String(message ?? "").toLowerCase();
  if (/(merci encore|fidèle|habitué|comme d'habitude|toujours chez vous)/i.test(t)) return "loyal";
  if (/(hésite|pas sûr|je ne sais pas|voir plus tard|demain|réfléchir|pas encore décidé)/i.test(t)) return "hesitant";
  if (/(vite|urgent|maintenant|tout de suite|asap|immédiat)/i.test(t)) return "rushed";
  if (/(nul|arnaque|mensonge|scam|marre|inadmissible|honte)/i.test(t)) return "aggressive";
  if (/(intéressant|montrez|vous avez quoi|catalogue|liste|options)/i.test(t)) return "curious";
  if (/(non merci|pas intéressé|laisse tomber|stop)/i.test(t)) return "cold";
  if (/(je prends|je commande|je valide|je paie)/i.test(t)) return "ready_to_buy";
  if (t.length > 12 && /[.!?]{2,}|\.\.\.|…/.test(t)) return "hesitant";
  return prev;
}

function inferInterestLevel(intent: SellerIntent, buyingIntent: number): InterestLevel {
  if (intent === "purchase_intent" || buyingIntent >= 72) return "hot";
  if (intent === "price_inquiry" || intent === "stock_inquiry" || intent === "delivery_inquiry" || buyingIntent >= 45) return "warm";
  return "cold";
}

function adjustBuyingIntent(prev: number, intent: SellerIntent, message: string): number {
  let n = prev;
  const len = message.trim().length;
  switch (intent) {
    case "purchase_intent":
      n += 28;
      break;
    case "price_inquiry":
    case "stock_inquiry":
      n += 14;
      break;
    case "delivery_inquiry":
      n += 10;
      break;
    case "negotiation":
      n += 8;
      break;
    case "curiosity":
      n += 6;
      break;
    case "complaint":
      n -= 12;
      break;
    case "greeting":
      n += 2;
      break;
    case "spam":
    case "off_topic":
      n -= 4;
      break;
    default:
      n += len > 120 ? 4 : 1;
  }
  if (len > 200) n += 3;
  return clamp(Math.round(n), 0, 100);
}

function inferLanguageStyle(tone: ProspectTone, prev: LanguageStylePreference): LanguageStylePreference {
  if (tone === "aggressive" || tone === "loyal" || tone === "ready_to_buy") return "neutral";
  if (tone === "hesitant" || tone === "cold") return "formal";
  if (tone === "curious") return prev === "formal" ? "formal" : "warm";
  return prev;
}

export function mergeConversationProfile(args: {
  prev: ConversationProfile | undefined;
  message: string;
  intent: SellerIntent;
}): ConversationProfile {
  const base: ConversationProfile = { ...DEFAULT_CONVERSATION_PROFILE, ...(args.prev ?? {}) };
  const tone = inferProspectTone(args.message, base.tone);
  const buyingIntent = adjustBuyingIntent(base.buyingIntent, args.intent, args.message);
  const interestLevel = inferInterestLevel(args.intent, buyingIntent);
  const hints = extractProductHintsFromMessage(args.message);
  const preferredProducts = uniqCap([...hints, ...base.preferredProducts], 8);

  const topicSnippet = args.message.trim().slice(0, 72).replace(/\s+/g, " ");
  const lastTopics = uniqCap([topicSnippet, ...base.lastTopics], 6).filter(Boolean);

  return {
    tone,
    interestLevel,
    buyingIntent,
    preferredProducts,
    lastTopics,
    preferredLanguageStyle: inferLanguageStyle(tone, base.preferredLanguageStyle),
  };
}

export function buildProfileMemoryLines(profile: ConversationProfile, intent: SellerIntent): string[] {
  const lines: string[] = [];
  lines.push(`Profil prospect: ton ${profile.tone}, intérêt ${profile.interestLevel}, intention achat ~${profile.buyingIntent}/100.`);
  lines.push(`Intention message: ${intent}.`);
  if (profile.preferredProducts.length) lines.push(`Produits / modèles évoqués: ${profile.preferredProducts.join(", ")}.`);
  lines.push(`Style de langage à privilégier: ${profile.preferredLanguageStyle}.`);
  return lines;
}
