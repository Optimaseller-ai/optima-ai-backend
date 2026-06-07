import "server-only";

const BANNED =
  /\b(comment puis-je|je peux vous aider|que recherchez|cherchez-vous|dites-moi ce que vous cherchez|votre budget|je suis une ia|en tant qu'ia)\b/i;

const FR_POOL = [
  "Salut 🙂",
  "Bonsoir 👋",
  "Je suis là 🙂",
  "Je vois 😄",
  "Hey salut",
  "Bien reçu",
  "Ça marche 🙂",
  "D'accord, je vois 🙂",
] as const;

const EN_POOL = ["Hey 🙂", "Hi there", "Got it", "I see", "Evening", "Sure"] as const;
const ES_POOL = ["Hola 🙂", "Buenas", "Vale", "Entendido", "De acuerdo"] as const;

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

function pick<T>(arr: readonly T[], seed: string): T {
  return arr[hashSeed(seed) % arr.length] ?? arr[0]!;
}

export function buildSocialHumanFallback(args?: {
  seed?: string;
  lang?: "fr" | "en" | "es";
  userMessage?: string;
}): string {
  const seed = String(args?.seed ?? args?.userMessage ?? "social");
  const lang = args?.lang ?? "fr";
  let out =
    lang === "en"
      ? pick(EN_POOL, seed)
      : lang === "es"
        ? pick(ES_POOL, seed)
        : pick(FR_POOL, seed);
  if (BANNED.test(out)) {
    out = lang === "en" ? "Hey" : lang === "es" ? "Hola" : "Salut";
  }
  return out;
}
