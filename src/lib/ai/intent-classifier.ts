import type { BusinessProfile } from "./whoami";

export type Intent =
  | "current_time"
  | "business_hours"
  | "weather"
  | "calculator"
  | "tracking"
  | "greeting"
  | "product_question"
  | "support"
  | "small_talk"
  | "general_knowledge"
  | "sales"
  | "objections"
  | "conversations";

export function classifyIntent(message: string): Intent {
  const normalized = message
    .toLowerCase()
    .trim();

  // Current time - specific patterns first
  if (
    /quelle heure|il est quelle heure|quelle est l'heure|quelle heure est-il|heure actuelle|time|what time/i.test(normalized)
  ) {
    return "current_time";
  }

  // Business hours
  if (
    /horaires? d'ouverture|quand ouvrez-vous|quand fermez-vous|heures d'ouverture|business hours|open|close/i.test(normalized)
  ) {
    return "business_hours";
  }

  // Weather
  if (
    /quel temps|meteo|weather|il fait|temperature|pluie|soleil|prévision|pleuvoir/i.test(normalized)
  ) {
    return "weather";
  }

  // Calculator - more specific to avoid false positives
  if (
    /^combien fait/.test(normalized) ||
    /combien fait$/.test(normalized) ||
    (/^[\d\s\+\-\*\/\(\)\.]+$/.test(normalized) && /[\d\+\-\*\/\(\)]/.test(normalized) && !/[a-zA-Z]/.test(normalized)) ||
    /^(calculer|calculator|math|racine|pourcentage)(\s+|$)/i.test(normalized) ||
    /racine\s+de|\bsquare\s+root\b/i.test(normalized)
  ) {
    return "calculator";
  }

  // Tracking (order/shipping) - be more specific to avoid false positives
  if (
    /^suivi$/i.test(normalized) || 
    /^tracking$/i.test(normalized) ||
    /suivi de commande/i.test(normalized) ||
    /expédition/i.test(normalized) ||
    /livraison.*suivi/i.test(normalized) ||
    /où est ma commande/i.test(normalized) ||
    /numero de suivi/i.test(normalized) ||
    /order.*tracking/i.test(normalized) ||
    /ship.*tracking/i.test(normalized)
  ) {
    return "tracking";
  }

  // Product question - check before greeting/small talk to avoid conflicts
  if (
    /produit/i.test(normalized) ||
    /article/i.test(normalized) ||
    /prix/i.test(normalized) ||
    /combien coûte/i.test(normalized) ||
    /disponible/i.test(normalized) ||
    /stock/i.test(normalized) ||
    /catalogue/i.test(normalized) ||
    /product/i.test(normalized) ||
    /price/i.test(normalized) ||
    /availability/i.test(normalized) ||
    /tarif/i.test(normalized) ||
    /coût/i.test(normalized) ||
    /quelle? (est|es) le? prix/i.test(normalized)
  ) {
    return "product_question";
  }

  // Support
  if (
    /problème/i.test(normalized) ||
    /issue/i.test(normalized) ||
    /help/i.test(normalized) ||
    /aide/i.test(normalized) ||
    /support/i.test(normalized) ||
    /ne fonctionne pas/i.test(normalized) ||
    /défectueux/i.test(normalized) ||
    /broken/i.test(normalized) ||
    /panne/i.test(normalized) ||
    /bug/i.test(normalized) ||
    /réclamation/i.test(normalized) ||
    /plainte/i.test(normalized) ||
    /insatisfait/i.test(normalized)
  ) {
    return "support";
  }

  // Greeting - be more specific to avoid conflicts with small talk
  if (
    /^bonjour($|\s|[!.])/i.test(normalized) || 
    /^salut($|\s|[!.])/i.test(normalized) ||
    /^bonsoir($|\s|[!.])/i.test(normalized) ||
    /^coucou($|\s|[!.])/i.test(normalized) ||
    /^hello($|\s|[!.])/i.test(normalized) ||
    /^hey($|\s|[!.])/i.test(normalized) ||
    /^hi($|\s|[!.])/i.test(normalized) ||
    /^bonne journée($|\s|[!.])/i.test(normalized) ||
    /^bonne soirée($|\s|[!.])/i.test(normalized)
  ) {
    return "greeting";
  }

  // Small talk - more specific patterns
  if (
    /^ça va($|\s|[!.])/i.test(normalized) ||
    /^comment ça va($|\s|[!.])/i.test(normalized) ||
    /^how are you($|\s|[!.])/i.test(normalized) ||
    /^merci($|\s|[!.])/i.test(normalized) ||
    /^thank you($|\s|[!.])/i.test(normalized) ||
    /^thanks($|\s|[!.])/i.test(normalized) ||
    /^ok($|\s|[!.])/i.test(normalized) ||
    /^d'accord($|\s|[!.])/i.test(normalized) ||
    /^cool($|\s|[!.])/i.test(normalized) ||
    /^sympa($|\s|[!.])/i.test(normalized)
  ) {
    return "small_talk";
  }

  // General knowledge - question words at the beginning
  if (
    /^qu'est-ce que/i.test(normalized) ||
    /^comment/i.test(normalized) ||
    /^pourquoi/i.test(normalized) ||
    /^qui est/i.test(normalized) ||
    /^what is/i.test(normalized) ||
    /^how to/i.test(normalized) ||
    /^who is/i.test(normalized) ||
    /^quand/i.test(normalized) ||
    /^où/i.test(normalized) ||
    /^quelle/i.test(normalized) ||
    /^quel/i.test(normalized) ||
    /^que signifie/i.test(normalized) ||
    /^que veut dire/i.test(normalized)
  ) {
    return "general_knowledge";
  }

  // Default to sales/conversation for business context
  return "sales";
}

export function getDeterministicResponse(
  intent: Intent,
  context: {
    timezone: string;
    businessProfile: BusinessProfile | null;
    currentDateTime: string;
  }
): string | null {
  const { timezone, businessProfile, currentDateTime } = context;

  switch (intent) {
    case "current_time": {
      // Format: "Il est actuellement 5h22 à Douala."
      // We have currentDateTime in format "yyyy-LL-dd HH:mm (timezone)"
      const timeMatch = currentDateTime.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);
      if (timeMatch) {
        const [, timePart] = timeMatch;
        const [date, time] = timePart.split(" ");
        const [hours, minutes] = time.split(":");
        const formattedHours = parseInt(hours, 10).toString();
        const formattedMinutes = parseInt(minutes, 10).toString().padStart(2, "0");
        const city = businessProfile?.city ?? "Douala";
        return `Il est actuellement ${formattedHours}h${formattedMinutes} à ${city}.`;
      }
      return `Il est actuellement ${currentDateTime.split(" ")[1]} à ${businessProfile?.city ?? "Douala"}.`;
    }

    case "business_hours": {
      // Default business hours: 9h-18h
      // In a real app, this would come from business profile settings
      const city = businessProfile?.city ?? "Douala";
      return `Nos horaires d'ouverture sont de 9h à 18h, du lundi au vendredi à ${city}.`;
    }

    case "weather": {
      // We don't have a weather API, so we return a generic response
      // In production, this would call a weather service
      return "Je ne peux pas accéder aux données météo en temps réel pour le moment. Veuillez consulter un service météo local.";
    }

    case "calculator": {
      // We don't implement a full calculator here for security and simplicity
      // In production, you might want to use a safe math library or disable this
      return "Je ne peux pas effectuer de calculs pour le moment. Veuillez utiliser une calculatrice.";
    }

    case "tracking": {
      // We don't have tracking implemented
      return "Le suivi de commande n'est pas encore disponible. Veuillez contacter notre support pour plus d'informations.";
    }

    default:
      return null;
  }
}

export function getQuickResponse(intent: Intent): string | null {
  switch (intent) {
    case "greeting":
      return "Bonjour ! Comment puis-je vous aider aujourd'hui ?";
    case "small_talk":
      if (/merci|thank you|thanks/i.test(intent)) {
        return "Je vous en prie !";
      }
      if (/ça va|how are you/i.test(intent)) {
        return "Je vais très bien, merci ! Et vous ?";
      }
      if (/ok|d'accord/i.test(intent)) {
        return "Parfait !";
      }
      return "Bonjour !";
    default:
      return null;
  }
}