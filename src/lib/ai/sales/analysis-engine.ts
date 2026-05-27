import { ProspectAnalysis, LeadTemperature, ProspectEmotion, TrustLevel, PurchaseIntention, ObjectionType, SalesStrategy } from "./types";

export const ANALYSIS_PROMPT = `
Analyze the prospect's current state based on the message and conversation history.
You must extract the following dimensions with high psychological precision:

1. Lead Temperature: [Cold, Warm, Hot]
2. Emotion: [Frustrated, Excited, Hesitant, Neutral, Joking, Skeptical]
3. Trust Level: [Low, Medium, High]
4. Purchase Intention: [Low, Medium, High]
5. Active Objections: [PRICE, DELIVERY, TRUST, COMPETITION, QUALITY, NONE]
6. Conversation Fatigue: (0.0 to 1.0)
7. Conversion Probability: (0 to 100%)

Based on this, determine the best Sales Strategy:
- SOFT_CONVERSATION: General build-up, no pressure.
- PRODUCT_GUIDANCE: Focus on features and value.
- TRUST_BUILDING: Focus on social proof, guarantees, and credibility.
- OBJECTION_HANDLING: Specifically address a detected objection.
- SOFT_CLOSE: Gentle nudge towards a decision.
- DIRECT_CLOSE: Confident move to finalize the sale.
- UPSELL: Naturally suggesting a better or additional option.
- FOLLOWUP_WAIT: Strategic pause or very light check-in.
- HUMAN_ESCALATION: Complex situation requiring human nuance.

Output ONLY a strict JSON object:
{
  "temperature": "...",
  "emotion": "...",
  "trust": "...",
  "intention": "...",
  "activeObjections": ["..."],
  "conversationFatigue": 0.0,
  "conversionProbability": 0,
  "suggestedStrategy": "...",
  "reasoning": "short explanation of why this strategy was chosen"
}
`;
