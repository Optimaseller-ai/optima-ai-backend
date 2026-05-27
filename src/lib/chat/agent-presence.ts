/**
 * Libellés discrets « présence humaine » (statut / frappe). À utiliser avec parcimonie.
 */

export type AgentPresenceKind = "thinking" | "checking" | "typing" | "idle";

export function agentPresenceLine(args: {
  agentFirstName: string;
  kind: AgentPresenceKind;
  businessHint?: string;
}): string {
  const n = String(args.agentFirstName ?? "Conseiller").trim() || "Conseiller";
  const short = n.split(/\s+/)[0] ?? n;

  switch (args.kind) {
    case "thinking":
      return `${short} consulte votre demande…`;
    case "checking":
      return `${short} vérifie le stock…`;
    case "typing":
      return `${short} prépare une réponse…`;
    case "idle":
    default:
      return args.businessHint ? `${short} — ${args.businessHint}` : `${short} est en ligne`;
  }
}
