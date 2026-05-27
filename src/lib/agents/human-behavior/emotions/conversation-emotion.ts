/**
 * Température émotionnelle conversationnelle (niveau 2 humanisation).
 * Importable côté client et serveur — pas de server-only.
 */

export type ConversationEmotionalTemperature =
  | "neutre"
  | "chaleureux"
  | "intéressé"
  | "frustré"
  | "irrité"
  | "froid"
  | "prêt_achat"
  | "hésitant";

const STRONG_ANGER =
  /\b(connard|connasse|fdp|putain|merde|crève|nique|😠|😡|🤬|fuck\s+you|screw\s+you)\b/i;

const FRUSTRATION_DISAPPOINT =
  /\b(déçu|décue|déçus|déçues|déception|tu\s+m['’]as\s+déçu|vous\s+m['’]avez\s+déçu|tu\s+me\s+déçois|vous\s+me\s+décevez|marre|ras\s*le\s*bol|plainte|réclamation|inadmissible|inacceptable|arnaque|scam|mensonge|honte)\b/i;

const REFUSES_ORDER =
  /\b(ne\s+souhaite\s+rien\s+commander|rien\s+commander|je\s+ne\s+commande\s+pas|je\s+ne\s+veux\s+pas\s+commander|pas\s+commander|no\s+order|won'?t\s+order|don'?t\s+want\s+to\s+buy|no\s+quiero\s+comprar|no\s+voy\s+a\s+comprar)\b/i;

const ERRORS_BLAME =
  /\b(trop\s+d['’]?erreurs|beaucoup\s+d['’]?erreurs|vous\s+faites\s+d['’]?erreurs|tu\s+fais\s+d['’]?erreurs|vous\s+vous\s+trompez|tu\s+te\s+trompes|robot|ia\b|chatgpt)\b/i;

const WARM =
  /\b(merci\s+beaucoup|merci\s+bcp|super\s+merci|parfait\s+merci|thanks\s+so\s+much|gracias\s+de\s+verdad)\b/i;

const READY_BUY =
  /\b(je\s+prends|je\s+commande|je\s+veux\s+l['’]?acheter|i['’]?ll\s+take\s+it|lo\s+compro|hago\s+el\s+pedido)\b/i;

const CURIOUS =
  /\b(intéressant|intéressante|curieux|curieuse|j['’]?aimerais\s+savoir|tell\s+me\s+more|c['’]est\s+quoi\s+exactement)\b/i;

const HESITANT =
  /\b(hésit|pas\s+sûr|pas\s+sure|je\s+sais\s+pas|sais\s+pas|doute|peut-être|maybe|no\s+sé|no\s+se)\b/i;

const COLD_SHORT = /^(non|no|nan|nop|bof|ok|okay|k)\.?$/i;

/**
 * Infère la température du dernier message prospect (heuristique rapide).
 */
export function inferConversationEmotionalTemperature(message: string): ConversationEmotionalTemperature {
  const t = String(message ?? "").trim();
  if (!t) return "neutre";
  const m = t.toLowerCase();

  if (STRONG_ANGER.test(t)) return "irrité";
  if (FRUSTRATION_DISAPPOINT.test(t) || ERRORS_BLAME.test(t) || REFUSES_ORDER.test(t)) return "frustré";
  if (READY_BUY.test(m)) return "prêt_achat";
  if (WARM.test(m)) return "chaleureux";
  if (HESITANT.test(m)) return "hésitant";
  if (CURIOUS.test(m)) return "intéressé";
  if (COLD_SHORT.test(m.trim())) return "froid";

  return "neutre";
}

/** Le prospect refuse clairement de commander — pas de relance commerciale immédiate. */
export function prospectExplicitlyRefusesOrder(message: string): boolean {
  return REFUSES_ORDER.test(String(message ?? ""));
}

/** Multiplicateur pauses UI (lecture / frappe) quand l’émotion est négative. */
export function clientEmotionalPauseBoost(message: string): number {
  const temp = inferConversationEmotionalTemperature(message);
  if (temp === "irrité" || temp === "frustré") return 1.42;
  if (temp === "hésitant") return 1.12;
  return 1.0;
}

/** Longueur max conseillée pour une réponse assistant si température négative (caractères). */
export function maxReplyCharsForTemperature(temp: ConversationEmotionalTemperature): number {
  if (temp === "irrité" || temp === "frustré") return 220;
  if (temp === "froid") return 120;
  return 420;
}

export type SellerPromptLangHint = "fr" | "en" | "es";

export function formatEmotionalTemperaturePromptBlock(
  temp: ConversationEmotionalTemperature,
  lang: SellerPromptLangHint,
): string | null {
  if (temp === "neutre") return null;

  if (lang === "en") {
    const lines: Record<ConversationEmotionalTemperature, string[] | null> = {
      neutre: null,
      frustré: [
        "EMOTIONAL TEMPERATURE: frustrated / disappointed.",
        "- WhatsApp rule: would a real human employee answer like this? If it sounds like bank support or ChatGPT, rewrite.",
        "- FORBIDDEN tone: therapist (“I understand what you feel”), corporate apologies, long paragraphs.",
        "- PREFER: very short, calm lines (often 1 sentence). Acknowledge without over-talking. No immediate upsell.",
        "- Examples of spirit (do not copy verbatim): “You’re right, sir.” / “I see.” / “Sorry it didn’t land well.” / “Fair enough.”",
      ],
      irrité: [
        "EMOTIONAL TEMPERATURE: angry.",
        "- Stay calm, brief, dignified. No lecture, no bullet points, no “I’m here to resolve this”.",
        "- One short human reply; then stop unless they ask something concrete.",
      ],
      chaleureux: ["EMOTIONAL TEMPERATURE: warm / thankful.", "- Match their warmth briefly; stay professional."],
      intéressé: ["EMOTIONAL TEMPERATURE: curious.", "- Answer clearly; keep it natural, not salesy."],
      froid: ["EMOTIONAL TEMPERATURE: cold / minimal.", "- Mirror brevity. Don’t flood them with enthusiasm."],
      prêt_achat: ["EMOTIONAL TEMPERATURE: ready to buy.", "- Clear next step; still human, not robotic checkout."],
      hésitant: ["EMOTIONAL TEMPERATURE: hesitant.", "- Reassure lightly; short sentences; no pressure stack."],
    };
    const block = lines[temp];
    return block ? block.join("\n") : null;
  }

  if (lang === "es") {
    const lines: Record<ConversationEmotionalTemperature, string[] | null> = {
      neutre: null,
      frustré: [
        "TEMPERATURA EMOCIONAL: frustrado / decepcionado.",
        "- Regla WhatsApp: ¿un humano real diría esto? Si suena a soporte bancario o IA, reformule.",
        "- PROHIBIDO: tono psicólogo, disculpas corporativas, párrafos largos.",
        "- PREFIERA: muy breve, calmado (a menudo 1 frase). Sin subir de tono. Sin venta inmediata.",
      ],
      irrité: [
        "TEMPERATURA EMOCIONAL: enfadado.",
        "- Calma, brevedad, dignidad. Nada de «estoy aquí para resolverlo». Una respuesta humana y stop.",
      ],
      chaleureux: ["TEMPERATURA EMOCIONAL: agradecido.", "- Responda con calidez breve; profesional."],
      intéressé: ["TEMPERATURA EMOCIONAL: curioso.", "- Clara y natural."],
      froid: ["TEMPERATURA EMOCIONAL: frío / mínimo.", "- Brevedad espejo."],
      prêt_achat: ["TEMPERATURA EMOCIONAL: listo para comprar.", "- Paso siguiente claro; humano."],
      hésitant: ["TEMPERATURA EMOCIONAL: indeciso.", "- Tranquilidad ligera; sin presión."],
    };
    const block = lines[temp];
    return block ? block.join("\n") : null;
  }

  const lines: Record<ConversationEmotionalTemperature, string[] | null> = {
    neutre: null,
    frustré: [
      "TEMPÉRATURE ÉMOTIONNELLE : frustré / déçu.",
      "- Règle WhatsApp : un vrai humain dirait-il ça naturellement ? Si ça sonne support bancaire ou ChatGPT, reformulez.",
      "- INTERDIT : ton psychologue (« je comprends ce que vous ressentez »), « je comprends votre frustration », « soyez rassuré », phrases corporate, longs paragraphes.",
      "- PRÉFÉREZ : très court, calme (souvent 1 phrase). Reconnaître sans en faire trop. Pas de relance commerciale tout de suite.",
      "- Esprit (ne pas copier) : « D’accord Monsieur. » / « Je vois. » / « On va reprendre calmement. » / « C’est noté. »",
    ],
    irrité: [
      "TEMPÉRATURE ÉMOTIONNELLE : énervé.",
      "- Calme, brièveté, retenue. Pas de cours, pas de « je suis là pour résoudre cela ». Une réponse humaine puis stop.",
    ],
    chaleureux: ["TEMPÉRATURE ÉMOTIONNELLE : chaleureux / remerciement.", "- Répondre brièvement à hauteur ; rester pro."],
    intéressé: ["TEMPÉRATURE ÉMOTIONNELLE : curieux.", "- Réponse claire, naturelle."],
    froid: ["TEMPÉRATURE ÉMOTIONNELLE : froid / minimal.", "- Miroiter la brièveté ; pas d’enthousiasme forcé."],
    prêt_achat: ["TEMPÉRATURE ÉMOTIONNELLE : prêt à acheter.", "- Prochaine étape claire ; toujours humain."],
    hésitant: ["TEMPÉRATURE ÉMOTIONNELLE : hésitant.", "- Rassurer léger ; phrases courtes ; pas d’empilement de pression."],
  };
  const block = lines[temp];
  return block ? block.join("\n") : null;
}

export function isStrongNegativeEmotionalTurn(message: string): boolean {
  const t = inferConversationEmotionalTemperature(message);
  return t === "frustré" || t === "irrité";
}
