/** Regex miroir — détection signaux sociaux WhatsApp (FR/EN/ES). */

export const SOCIAL_PRODUCT =
  /\b(prix|stock|dispo|commander|acheter|livraison|modèle|modele|article|lien|payer|fcfa|€|devis)\b/i;

export const SOCIAL_WELLBEING =
  /\b(ça\s+va|ca\s+va|comment\s+tu\s+vas|comment\s+vas[- ]?tu|comment\s+allez|vous\s+allez\s+bien|tu\s+vas\s+bien|la\s+forme|how\s+are\s+you|you\s+ok|qué\s+tal|cómo\s+estás)\b/i;

/** Relance bien-être après échange (« et vous ? », « et ta journée ? »). */
export const SOCIAL_WELLBEING_FOLLOWUP =
  /(?:^|\s)(et\s+(?:ta|votre|ton)\s+journ[ée]e|et\s+vous|et\s+toi|et\s+de\s+votre\s+c[oô]t[ée]|and\s+you|y\s+usted|y\s+t[uú])\s*[\?!.…]*$/i;

export const SOCIAL_WELLBEING_FOLLOWUP_INLINE =
  /\b(et\s+(?:ta|votre|ton)\s+journ[ée]e|et\s+vous|et\s+toi)\b/i;

export const SOCIAL_PERSONAL_ACTIVITY =
  /\b(tu\s+fais\s+quoi|vous\s+faites\s+quoi|qu['’]?est[- ]ce que tu fais|qu['’]?est[- ]ce que vous faites|tu\s+es\s+en\s+train\s+de\s+quoi|vous\s+êtes\s+en\s+train\s+de\s+quoi|what\s+are\s+you\s+doing|qué\s+haces|t['’]?es\s+où|tu\s+es\s+où|vous\s+êtes\s+où|encore\s+au\s+bureau|encore\s+en\s+boutique|tu\s+bosses|vous\s+travaillez)\b/i;

/** Prospect relance une question déjà posée (frustration légère). */
export const SOCIAL_QUESTION_REPEAT =
  /\b(j['’]?ai\s+demand[ée]r?|j\s+ai\s+demand[ée]r?|je\s+redis|j\s+avais\s+demand[ée]r?|déjà\s+demand[ée]r?|toujours\s+pas\s+de\s+r[ée]ponse|vous\s+n['’]?avez\s+pas\s+r[ée]pondu|tu\s+n['’]?as\s+pas\s+r[ée]pondu)\b/i;

export const SOCIAL_DAY_OR_MOOD =
  /\b(ta\s+journ[ée]e|votre\s+journ[ée]e|comment\s+vas|comment\s+allez|ça\s+va|ca\s+va)\b/i;
