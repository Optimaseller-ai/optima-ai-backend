import "server-only";

export type ResponseInstinct = "short_ack" | "reassure" | "detail_sparse" | "slow_down" | "stop_selling";

export type ResponseInstinctSnapshot = {
  primary: ResponseInstinct;
  secondary?: ResponseInstinct;
  noteFr: string;
  noteEn: string;
  noteEs: string;
};

/**
 * Quand répondre court, rassurer, détailler, ralentir, arrêter la vente.
 */
export function inferResponseInstinct(args: {
  userMessage: string;
  turnCount: number;
  relationalRepair: boolean;
}): ResponseInstinctSnapshot {
  const m = String(args.userMessage ?? "").trim();
  const low = m.toLowerCase();

  if (/\b(stop|arr[eê]tez|laissez\s+tomber|plus\s+rien|not\s+interested)\b/i.test(low)) {
    return {
      primary: "stop_selling",
      noteFr: "Sortie nette demandée — pas de relance commerciale dans le même souffle.",
      noteEn: "They want out — no extra sell in the same breath.",
      noteEs: "Quieren parar — sin venta extra en el mismo aliento.",
    };
  }
  if (
    /\b(je\s+vous\s+d[eé]range|sorry\s+to\s+bother|d[eé]sol[eé]\s+de\s+d[eé]ranger)\b/i.test(low) ||
    args.relationalRepair
  ) {
    return {
      primary: "reassure",
      noteFr: "Priorité réassurance humaine courte.",
      noteEn: "Short human reassurance first.",
      noteEs: "Reaseguro humano corto primero.",
    };
  }
  if (m.length < 14 && /^(ok|oui|d'accord|dac|merci|thanks|gracias)\b/i.test(low)) {
    return {
      primary: "short_ack",
      noteFr: "Message minimal — réponse courte miroir si approprié.",
      noteEn: "Minimal message — short mirrored reply if fitting.",
      noteEs: "Mensaje mínimo — respuesta corta espejo si calza.",
    };
  }
  if (/\b(combien|pourquoi|explique|detail|d[eé]tail|how\s+does)\b/i.test(low) && m.length > 28) {
    return {
      primary: "detail_sparse",
      secondary: "slow_down",
      noteFr: "Besoin d’info — détailler avec parcimonie, phrases courtes.",
      noteEn: "They want detail — stay sparse, short lines.",
      noteEs: "Quieren detalle — poco a poco, líneas cortas.",
    };
  }
  if (args.turnCount > 22 && m.length > 120) {
    return {
      primary: "slow_down",
      noteFr: "Fil long — rythme plus posé, une idée par message.",
      noteEn: "Long thread — slower pace, one idea per message.",
      noteEs: "Hilo largo — ritmo más calmado, una idea por mensaje.",
    };
  }
  return {
    primary: "detail_sparse",
    noteFr: "Réponse équilibrée — ton constant, pas surcharge.",
    noteEn: "Balanced reply — steady voice, don’t overload.",
    noteEs: "Equilibrado — voz estable, sin saturar.",
  };
}
