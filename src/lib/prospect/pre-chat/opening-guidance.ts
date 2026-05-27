/**
 * Consignes agent quand le prospect n’a pas précisé de besoin au pré-chat.
 */

import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";

export function prospectHasExplicitPreChatNeed(lead?: SmartProspectProfile): boolean {
  return Boolean(String(lead?.primaryNeed ?? "").trim().length >= 2);
}

export function formatPreChatOpeningGuidanceBlock(args: {
  lead?: SmartProspectProfile;
  businessName: string;
  agentName: string;
  lang?: "fr" | "en" | "es";
}): string | null {
  if (!args.lead?.name?.trim()) return null;
  if (prospectHasExplicitPreChatNeed(args.lead)) return null;

  const name = args.lead.name.trim();
  const biz = args.businessName.trim() || "notre boutique";
  const agent = args.agentName.trim() || "Conseiller";
  const lang = args.lang ?? args.lead.language ?? "fr";

  if (lang === "en") {
    return [
      "PRE-CHAT — NO STATED NEED (CRITICAL):",
      `- ${name} only shared name + contact — they did NOT specify a product or purchase intent.`,
      "- Welcome them like WhatsApp: warm, zero CRM pressure.",
      `- Open naturally: "Good evening. Welcome to ${biz}."`,
      '- Then ONE light line: "Were you looking at something in particular?" OR "I can show you what we have right now."',
      "- FORBIDDEN: forced qualification, « what do you want to buy », aggressive sales opener.",
    ].join("\n");
  }

  if (lang === "es") {
    return [
      "PRE-CHAT — SIN NECESIDAD INDICADA:",
      `- ${name} solo dejó nombre y contacto.`,
      `- Saludo natural: « Buenas tardes. Bienvenido a ${biz}. »`,
      "- Una línea suave: « ¿Había visto algún modelo en particular? » o « Le presento lo que tenemos ahora. »",
      "- Prohibido: tono formulario CRM o presión de compra.",
    ].join("\n");
  }

  return [
    "PRÉ-CHAT — PAS DE BESOIN PRÉCISÉ (CRITIQUE) :",
    `- ${name} a seulement laissé prénom + contact — aucune intention d’achat déclarée.`,
    "- Accueil type WhatsApp premium : chaleureux, zéro pression commerciale.",
    `- Ouvrir naturellement : « Bonsoir Monsieur. Bienvenue chez ${biz}. » (${agent})`,
    "- Puis UNE relance légère au choix (pas les deux) : « Vous aviez vu un produit en particulier ? » OU « Je peux déjà vous présenter ce que nous avons actuellement. »",
    "- INTERDIT : « quel est votre besoin », qualification CRM, supposer qu’il veut commander.",
  ].join("\n");
}
