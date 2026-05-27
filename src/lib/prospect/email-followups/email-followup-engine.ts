import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";

export type EmailFollowupKind =
  | "gentle_followup"
  | "order_confirmation"
  | "quote_reminder"
  | "availability_check"
  | "order_status";

export type HumanEmailDraft = {
  subject: string;
  body: string;
  kind: EmailFollowupKind;
};

export type EmailFollowupInput = {
  profile: SmartProspectProfile;
  agentName: string;
  businessName: string;
  kind: EmailFollowupKind;
  productFocus?: string;
  lang?: "fr" | "en" | "es";
};

function honorificFr(name: string): string {
  const n = name.trim();
  return n ? `${n}` : "";
}

export function draftHumanEmail(input: EmailFollowupInput): HumanEmailDraft {
  const lang = input.lang ?? input.profile.language ?? "fr";
  const focus = input.productFocus?.trim() || input.profile.preferredProducts?.[0]?.trim();
  const agent = input.agentName.trim() || "Bryan";
  const biz = input.businessName.trim() || "notre boutique";

  if (lang === "en") {
    const subject =
      input.kind === "order_confirmation"
        ? "Your request this morning"
        : input.kind === "quote_reminder"
          ? "About your quote"
          : "Following up on your message";
    const body = [
      `Hi ${honorificFr(input.profile.name)},`,
      "",
      focus
        ? `I'm getting back to you about “${focus}” you looked at earlier.`
        : `I'm getting back to you about your message earlier today.`,
      "",
      input.kind === "availability_check"
        ? "It's still available at the moment."
        : "Still here if you need anything.",
      "",
      agent,
      "Sales team",
    ].join("\n");
    return { subject, body, kind: input.kind };
  }

  const subject =
    input.kind === "order_confirmation"
      ? "Votre demande de ce matin"
      : input.kind === "quote_reminder"
        ? "Votre devis"
        : input.kind === "order_status"
          ? "Suivi de votre commande"
          : "Votre message";

  const opening =
    input.kind === "gentle_followup"
      ? `Bonsoir ${honorificFr(input.profile.name)},`
      : `Bonjour ${honorificFr(input.profile.name)},`;

  const core = focus
    ? `Je reviens vers vous concernant le modèle consulté plus tôt aujourd’hui.`
    : `Je reviens vers vous concernant votre demande d’hier.`;

  const availability =
    input.kind === "availability_check" || input.kind === "gentle_followup"
      ? "Il est toujours disponible actuellement."
      : input.kind === "order_confirmation"
        ? "Nous avons bien enregistré votre demande."
        : "Je reste disponible si besoin.";

  const body = [
    opening,
    "",
    core,
    "",
    availability,
    "",
    "Je reste disponible si besoin.",
    "",
    agent,
    "Service commercial",
    biz !== "notre boutique" ? biz : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, body, kind: input.kind };
}
