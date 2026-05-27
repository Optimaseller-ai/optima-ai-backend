import type { SocialTeasingDetection } from "./social-teasing-detector";

function seedPick(seed: string, arr: string[]) {
  const s = String(seed ?? "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return arr.length ? arr[h % arr.length] : "";
}

export function humanSocialResponseEngine(input: {
  message: string;
  reply: string;
  agentName?: string;
  businessName?: string;
  lang: "fr" | "en" | "es";
  teasing: SocialTeasingDetection;
  seed?: string;
}): string {
  const { message, teasing, lang } = input;
  const seed = input.seed ?? `${message}|${teasing.reason}|${lang}`;

  const isFr = lang === "fr";
  const isEn = lang === "en";
  const isEs = lang === "es";

  const FR: Record<SocialTeasingDetection["kind"], string[]> = {
    teasing: ["😂 bien sûr", "tu me testes là 😄", "j'avoue, t'es pas venu pour rien 😄", "oui un peu faut pas croire"],
    humor: ["mdr 😄", "t’es drôle toi", "ahaha 😄 j'aime bien", "ok ok 😄"],
    sarcasm: ["t'inquiète, je fais mon travail quand même 😄", "ça va, j'ai compris 😅", "oui oui… je vérifie 😄"],
    casual: ["ça dépend des jours 😄", "tranquille 🙂", "oui voilà 😄", "j'suis là, tranquille"],
    social_bonding: ["ah oui je vois", "ok je te suis 🙂", "d’accord 😄", "je capte 🙂"],
    provocation: ["tu m'as eu 😄", "oui mais bon… on avance quand même 🙂", "je vois le jeu 😅", "allez vas-y 😉"],
    small_talk: ["bon, on avance 🙂", "hmm ok", "d'accord 🙂", "oui voilà 🙂"],
  };

  const EN: Record<SocialTeasingDetection["kind"], string[]> = {
    teasing: ["😂 you’re testing me", "ok ok 😄", "sure 🙂", "lol, fair point 😄"],
    humor: ["lol 😄", "you’re funny", "haha 😄", "ok ok 😄"],
    sarcasm: ["yeah yeah, I get it 😅", "alright alright 😄", "sure… I’ll check 😄"],
    casual: ["depends 🙂", "we’re good 🙂", "honestly 😄", "all good 🙂"],
    social_bonding: ["got you 🙂", "i see you 🙂", "d’accord 😄", "yep 🙂"],
    provocation: ["you got me 😄", "nice one 😅", "ok let’s do it 🙂", "i caught that 😉"],
    small_talk: ["alright 🙂", "yep 🙂", "ok 🙂", "sure 🙂"],
  };

  const ES: Record<SocialTeasingDetection["kind"], string[]> = {
    teasing: ["😂 tú me pruebas", "vale vale 😄", "sí 🙂", "jaja, justo 😄"],
    humor: ["mdr 😄", "eres gracioso", "jajaja 😄", "ok ok 😄"],
    sarcasm: ["tranqui, sigo trabajando 😄", "sí sí… ya entendí 😅", "venga 😄"],
    casual: ["depende de los días 😄", "tranqui 🙂", "sí, ya 🙂", "estoy aquí"],
    social_bonding: ["ah ya veo", "ok te sigo 🙂", "de acuerdo 😄", "te entiendo 🙂"],
    provocation: ["me pillaste 😄", "sí pero igual avanzamos 🙂", "veo tu juego 😅", "vamos 😉"],
    small_talk: ["vale 🙂", "hmm ok", "de acuerdo 🙂", "sí 🙂"],
  };

  const pool = isFr ? FR : isEn ? EN : ES;
  const chosen = pool[teasing.kind] ? seedPick(seed, pool[teasing.kind]) : seedPick(seed, pool.small_talk);
  // Ensure we keep it short (1-2 lines).
  return String(chosen ?? "").trim().replace(/\n{2,}/g, "\n").slice(0, 140);
}

