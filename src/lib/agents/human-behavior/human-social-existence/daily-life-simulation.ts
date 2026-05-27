import "server-only";

function pick<T>(arr: T[], seed: string, salt: string): T {
  let h = 0;
  const s = `${seed}|${salt}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return arr[h % arr.length]!;
}

export type DailyLifeCueFr = { line: string; context: "calm_store" | "busy_day" | "desk" | "logistics" | "check_done" };

/** Indices rares de journée de travail (formes — le modèle adapte). */
export function pickDailyLifeSimulationCue(args: {
  microSeed: string;
  turnCount: number;
  lang: "fr" | "en" | "es";
}): DailyLifeCueFr | null {
  const t = Math.max(0, args.turnCount);
  let h = 0;
  for (let i = 0; i < args.microSeed.length; i++) h = (h * 33 + args.microSeed.charCodeAt(i) + t) >>> 0;
  if ((h % 11) !== 0 && (h % 13) !== 0) return null;

  if (args.lang === "en") {
    const cues: DailyLifeCueFr[] = [
      { line: "Shape: just finished a quick stock check.", context: "check_done" },
      { line: "Shape: store’s quiet right now.", context: "calm_store" },
      { line: "Shape: still at the desk.", context: "desk" },
      { line: "Shape: courier just swung by.", context: "logistics" },
      { line: "Shape: day’s a bit busy on our side.", context: "busy_day" },
    ];
    return pick(cues, args.microSeed, `dl|${t}`);
  }
  if (args.lang === "es") {
    const cues: DailyLifeCueFr[] = [
      { line: "Forma: acabo de terminar una verificación rápida.", context: "check_done" },
      { line: "Forma: ahora la tienda está tranquila.", context: "calm_store" },
      { line: "Forma: sigo aquí en el escritorio.", context: "desk" },
      { line: "Forma: el mensajero acaba de pasar.", context: "logistics" },
      { line: "Forma: el día va cargado.", context: "busy_day" },
    ];
    return pick(cues, args.microSeed, `dl|${t}`);
  }
  const cues: DailyLifeCueFr[] = [
    { line: "Forme courte : « je viens de finir une vérification » (une fois max).", context: "check_done" },
    { line: "Forme : le magasin est calme là.", context: "calm_store" },
    { line: "Forme : je suis encore au bureau.", context: "desk" },
    { line: "Forme : le livreur vient de passer.", context: "logistics" },
    { line: "Forme : la journée est assez chargée.", context: "busy_day" },
  ];
  return pick(cues, args.microSeed, `dl|${t}`);
}
