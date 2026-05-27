const FORBIDDEN_EMOJIS = ["😊", "😉", "✨", "🙌", "💯", "🔥", "🚀"] as const;
const ALLOWED_EMOJIS = ["😂", "😄", "👍", "👌"] as const;

function countEmoji(text: string) {
  return (String(text ?? "").match(/[\p{Extended_Pictographic}]/gu) ?? []).length;
}

function stripAllEmoji(text: string) {
  return String(text ?? "").replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").replace(/\s{2,}/g, " ").trim();
}

function stripForbiddenEmoji(text: string) {
  let out = String(text ?? "");
  for (const e of FORBIDDEN_EMOJIS) out = out.split(e).join("");
  return out;
}

function keepOnlyAllowedEmoji(text: string) {
  // Remove any emoji not in ALLOWED_EMOJIS (keep at most one allowed emoji).
  let out = String(text ?? "");
  const emojis = out.match(/[\p{Extended_Pictographic}]/gu) ?? [];
  let kept = 0;
  out = out.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, (m) => {
    if (!ALLOWED_EMOJIS.includes(m as any)) return "";
    kept += 1;
    return kept === 1 ? m : "";
  });
  // Also remove repeated identical emoji like 😂😂
  out = out.replace(/([\p{Extended_Pictographic}])\1+/gu, "$1");
  return out.replace(/\s{2,}/g, " ").trim();
}

function isProfessionalContext(message: string) {
  const m = String(message ?? "").toLowerCase();
  return /\b(prix|tarif|€|fcfa|horaires?|ouvert|ferme|sav|rembours|retour|commande|payer|paiement|facture|probl[eè]me|bug|livraison)\b/i.test(
    m,
  );
}

export function enforcePremiumEmojiPolicy(input: {
  reply: string;
  userMessage: string;
  prospectEmojiFreq01?: number;
  humor01?: number;
  socialMode?: boolean;
  repliesSinceLastEmoji?: number;
}): { text: string; removedAll: boolean; reason: string; beforeEmoji: number; afterEmoji: number } {
  const beforeEmoji = countEmoji(input.reply);
  let text = String(input.reply ?? "").trim();

  // Default: no emoji.
  let reason = "default_no_emoji";

  const professional = isProfessionalContext(input.userMessage);
  if (professional) {
    const out = stripAllEmoji(text);
    return { text: out, removedAll: beforeEmoji > 0, reason: "professional_context", beforeEmoji, afterEmoji: 0 };
  }

  // Mirror rule: if prospect uses almost none, we use none.
  const freq = typeof input.prospectEmojiFreq01 === "number" ? input.prospectEmojiFreq01 : 0;
  if (freq < 0.25) {
    const out = stripAllEmoji(text);
    return { text: out, removedAll: beforeEmoji > 0, reason: "prospect_no_emoji_mirror", beforeEmoji, afterEmoji: 0 };
  }

  // Allow only in emotional/light context, and rarely.
  const humor = typeof input.humor01 === "number" ? input.humor01 : 0;
  const social = input.socialMode === true;
  const since = input.repliesSinceLastEmoji ?? 99;

  const allowRare =
    (humor >= 0.55 || social) &&
    since >= 8; // stronger than previous 6-10 rule: enforce >=8

  if (!allowRare) {
    const out = stripAllEmoji(text);
    return { text: out, removedAll: beforeEmoji > 0, reason: "emoji_not_allowed_now", beforeEmoji, afterEmoji: 0 };
  }

  // If allowed: keep only allowed emojis, max 1, no forbidden.
  text = stripForbiddenEmoji(text);
  text = keepOnlyAllowedEmoji(text);

  const afterEmoji = countEmoji(text);
  reason = afterEmoji > 0 ? "emoji_allowed_rare" : "emoji_allowed_but_none_present";

  return { text, removedAll: beforeEmoji > 0 && afterEmoji === 0, reason, beforeEmoji, afterEmoji };
}

