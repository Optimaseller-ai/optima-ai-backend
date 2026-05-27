import { snapUtcInstantOutOfQuietHours } from "@/lib/agents/timing/quiet-hours";

export type ConversationStatus = "active" | "interested" | "pending" | "closed_won" | "closed_lost";

export function isClosedStatus(status: string | null | undefined) {
  return status === "closed_won" || status === "closed_lost";
}

export function getNextRelanceAt(args: {
  relanceCount: number;
  from: Date;
  businessIanaTimezone?: string | null;
}) {
  const n = Math.max(0, Math.floor(args.relanceCount));
  const base = args.from.getTime();

  const nextNumber = n + 1;
  const minutes =
    nextNumber === 1 ? 30 : nextNumber === 2 ? 120 : nextNumber === 3 ? 24 * 60 : null;
  if (minutes == null) return null;
  let nextMs = base + minutes * 60_000;
  const tz = args.businessIanaTimezone?.trim();
  if (tz) nextMs = snapUtcInstantOutOfQuietHours(nextMs, tz);
  return new Date(nextMs).toISOString();
}

export function detectStatusFromUserMessage(text: string): ConversationStatus | null {
  const s = String(text ?? "").toLowerCase();
  if (!s.trim()) return null;

  const lost = [
    "pas intéressé",
    "pas interesse",
    "pas intéressée",
    "non merci",
    "laisse tomber",
    "laissez tomber",
    "ça ne m'intéresse pas",
    "ca ne m'interesse pas",
    "j'en veux pas",
    "je n'en veux pas",
    "stop",
  ];
  if (lost.some((k) => s.includes(k))) return "closed_lost";

  const won = [
    "je prends",
    "je le prends",
    "je la prends",
    "je commande",
    "je valide",
    "ok je prends",
    "d'accord je prends",
    "je paie",
    "je paye",
    "où je paie",
    "ou je paie",
  ];
  if (won.some((k) => s.includes(k))) return "closed_won";

  return null;
}
