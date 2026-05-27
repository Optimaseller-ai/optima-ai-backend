export type ClosingLevel = "SOFT" | "MEDIUM" | "DIRECT";

export const CLOSING_GRADIENT = {
  SOFT: [
    "Would it make sense to explore this further?",
    "Do you think this would help you with [Pain Point]?",
    "Would you be open to a quick trial of this?",
    "Does this sound like the right direction for you?"
  ],
  MEDIUM: [
    "Shall we move forward with the setup?",
    "I can reserve a spot for you this week, would that work?",
    "Would you like me to send the validation link now?",
    "Are we aligned on the next step to get this started?"
  ],
  DIRECT: [
    "I'll prepare your delivery now. Should I send the invoice?",
    "Let's validate your order. I'm ready to launch it today.",
    "I can finalize this for you right now. Do we go ahead?",
    "Your order is ready. Just confirm the last detail and we're live."
  ]
};

export function getClosingPhrase(level: ClosingLevel): string {
  const options = CLOSING_GRADIENT[level];
  return options[Math.floor(Math.random() * options.length)];
}
