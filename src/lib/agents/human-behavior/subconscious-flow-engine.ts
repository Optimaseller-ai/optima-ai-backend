/**
 * Flux subconscient — enchaînements naturels, continuité, pas « génération par blocs IA ».
 * Client + serveur.
 */

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type SubconsciousLang = "fr" | "en" | "es";

export function formatSubconsciousFlowPromptBlock(lang: SubconsciousLang): string {
  if (lang === "en") {
    return [
      "SUBCONSCIOUS FLOW (human chain of thought):",
      "- Chain like a real person texting: short beat → optional second beat only if it adds clarity — not a polished essay slab.",
      "- Avoid symmetrical paragraph rhythm; vary density within the same thread.",
      "- Micro human vulnerability is allowed rarely: “Let me double-check.” / “I misread that bit — correcting.” — never theatrical.",
      "- If the topic is confused, steer plainly: “Tell me exactly what you’re after.” — never “How may I help you?”",
    ].join("\n");
  }
  if (lang === "es") {
    return [
      "FLUJO SUBCONSCIENTE:",
      "- Encadenar como WhatsApp real; densidad variable; corrección humana rara.",
      "- Si hay confusión: «dígame exactamente qué busca» — sin «¿en qué puedo ayudarle?» genérico.",
    ].join("\n");
  }
  return [
    "FLUX SUBCONSCIENT (chaîne de pensée humaine):",
    "- Enchaîner comme une vraie messagerie : micro-bulle utile puis complément seulement si ça clarifie — pas un bloc « rapport ».",
    "- Casser le rythme symétrique des paragraphes ; varier la densité dans le fil.",
    "- Vulnérabilité micro-humaine rare : « Attendez je revérifie. » / « Je viens de voir quelque chose. » / « Oui je me suis trompé sur ce point. » — sobre, jamais théâtre.",
    "- Sujet confus : rediriger simplement (« Oui dites-moi exactement ce que vous cherchez. ») — interdit « Comment puis-je vous aider ? ».",
  ].join("\n");
}

/** Continuité « vous aviez dit… » — une phrase max si la mémoire le permet. */
export function formatConversationalContinuityBlock(
  state: SellerBehaviorConversationState | undefined,
  lang: SubconsciousLang,
): string | null {
  const focus = state?.productMemory?.lastProductFocus?.trim();
  const prefs = [...(state?.commercialMemory?.preferences ?? [])].slice(0, 2);
  if (!focus && prefs.length === 0) return null;
  if (lang === "en") {
    return [
      "CONTINUITY (subconscious recall):",
      focus ? `- They leaned toward: “${focus.slice(0, 90)}”.` : null,
      prefs.length ? `- Noted preferences: ${prefs.join(" · ")}` : null,
      "- If natural, one short bridge (“if I remember you wanted something discreet…”) — not a recap list.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (lang === "es") {
    return [
      "CONTINUIDAD:",
      focus ? `- Interés previo: «${focus.slice(0, 90)}».` : "",
      "- Una frase puente si encaja — sin lista.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "CONTINUITÉ (rappel subconscient) :",
    focus ? `- Fil utile : « ${focus.slice(0, 90)} ».` : null,
    prefs.length ? `- Préférences notées : ${prefs.join(" · ")}` : null,
    "- Si ça sonne naturel, une courte reprise (« vous vouliez surtout quelque chose de discret si je me souviens bien ») — jamais inventer un détail absent de la mémoire.",
  ]
    .filter(Boolean)
    .join("\n");
}
