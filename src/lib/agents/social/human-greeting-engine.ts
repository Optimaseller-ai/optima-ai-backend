import { buildHumanSocialGreetingReply } from "./human-social-replies";

export type GreetingReplyInput = {
  message: string;
  agentName: string;
  businessName: string;
  businessIanaTimezone?: string;
  personaKey?: string | null;
  prospectProfile?: import("@/lib/agents/memory/prospect-profile").ProspectProfile;
  welcomeAlreadyDelivered?: boolean;
  allowEmoji?: boolean;
  lang: "fr" | "en" | "es";
};

/** Réponses salutation naturelles — délégué à human-social-replies (miroir bonsoir/bonjour). */
export function buildHumanGreetingReply(input: GreetingReplyInput): string {
  return buildHumanSocialGreetingReply(input);
}
