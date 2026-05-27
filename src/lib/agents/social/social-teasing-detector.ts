export type SocialTeasingDetection = {
  active: boolean;
  kind:
    | "teasing"
    | "humor"
    | "sarcasm"
    | "casual"
    | "social_bonding"
    | "provocation"
    | "small_talk";
  reason: string;
  matched?: string[];
};

function norm(s: string) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectSocialTeasing(input: { message: string }): SocialTeasingDetection {
  const msg = norm(input.message);
  if (!msg) {
    return { active: false, kind: "small_talk", reason: "empty" };
  }

  const matched: string[] = [];

  const patterns: Array<{ re: RegExp; kind: SocialTeasingDetection["kind"]; reason: string; label: string }> = [
    { re: /\btoi\b.*\b(papote|discute|tu papotes|tu papotes seulement)\b/i, kind: "teasing", reason: "toi_papote_only", label: "papote_only" },
    { re: /\btu\b.*\b(travaille|boss|travaux)\b.*\b(vraiment|là)\b/i, kind: "provocation", reason: "tu_travailles_vraiment", label: "travaille_vraiment" },
    { re: /\btu\b.*\bdors\b.*\b(jamais|jamais)\b/i, kind: "teasing", reason: "tu_dors_jamais", label: "dors_jamais" },
    { re: /\btu\b.*\b(dragues|dragueras|draguer)\b.*\bquoi\b/i, kind: "teasing", reason: "dragues_ou_quoi", label: "dragues_ou_quoi" },
    { re: /\b(je\s*te\s*teste|je\s*t[eé]teste|te\s*teste|tu\s*me\s*teste)\b/i, kind: "provocation", reason: "test_de_reponse", label: "test_de_reponse" },
    { re: /\btu\b.*\b(es\s+dr[oô]le|dr[oô]le)\b/i, kind: "humor", reason: "tu_es_drole", label: "drole" },
    { re: /\b(ça\s*va|comment\s+tu\s*vas|hmm|mdr|lol|t[']inqui[eè]tes|tranquille|cool)\b/i, kind: "casual", reason: "casual_humor_markers", label: "casual_markers" },
    { re: /\btu\b.*\bconnais\b.*\b(m[êe]me|quoi)\b/i, kind: "provocation", reason: "tu_connais_quoi_meme", label: "connais_quoi" },
    { re: /\b(pourquoi|comment)\b.*\btoi\b/i, kind: "small_talk", reason: "question_about_agent", label: "question_about_agent" },
    { re: /\btoi\b.*\btu\b.*\b(vraiment|serieux|mdr)\b/i, kind: "humor", reason: "agent_personal_joke", label: "agent_joke" },
  ];

  for (const p of patterns) {
    if (p.re.test(msg)) matched.push(p.label);
  }

  // Lightweight humor/sarcasm: emojis + teasing verbs or question marks.
  const sarcasmIndicators = /\b(vraiment|s[ée]rieuse|t[’']es\s*s[eé]rieuse|mdr|mdrr|pas\s+possible|grave|trop)\b/i;
  const humorEmoji = /😂|🤣|😄|😅|😆|😉|😏|🤭/;
  const questionLike = /\?/;

  const hasCore =
    matched.length > 0 ||
    (sarcasmIndicators.test(msg) && (humorEmoji.test(msg) || questionLike.test(msg))) ||
    /\b(dragues|papote|travaille)\b/.test(msg);

  if (!hasCore) return { active: false, kind: "small_talk", reason: "no_teasing_markers" };

  // Choose kind by precedence of matched labels.
  const kind: SocialTeasingDetection["kind"] =
    matched.includes("dragues_ou_quoi") ? "provocation" :
    matched.includes("dors_jamais") ? "teasing" :
    matched.includes("papote_only") ? "teasing" :
    matched.includes("connais_quoi_meme") ? "provocation" :
    matched.includes("test_de_reponse") ? "provocation" :
    matched.length && patterns.find((p) => matched.includes(p.label) && p.kind === "humor") ? "humor" :
    "casual";

  const primary =
    matched[0] ??
    (sarcasmIndicators.test(msg) ? "sarcasm" : "casual");

  return { active: true, kind, reason: String(primary), matched };
}

