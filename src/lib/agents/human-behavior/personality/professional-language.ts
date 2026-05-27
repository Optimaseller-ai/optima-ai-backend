import "server-only";

/** Retire tutoiements / familiarités en tête de message assistant (léger, sans NLP lourd). */
export function stripCasualOpeners(text: string): string {
  let out = String(text ?? "").trim();
  out = out.replace(/^(hey|yo|salut|coucou|hi|hello)\b[!,. ]*/i, "").trim();
  return out;
}

/** Réduit les répétitions de ponctuation « enthousiasme artificiel ». */
export function softenArtificialEnthusiasm(text: string): string {
  return String(text ?? "")
    .replace(/!{2,}/g, "!")
    .replace(/\?{2,}/g, "?")
    .trim();
}
