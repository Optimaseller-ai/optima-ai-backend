import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type FollowupMemory = {
  promises: string[];
  plannedFollowups: string[];
  productInterest: string[];
  implicitCart: string[];
  updatedAt: number;
};

export function captureFollowupMemory(
  message: string,
  state: SellerBehaviorConversationState | undefined,
): FollowupMemory {
  const base = ((state as any)?.followupMemory ?? {}) as Partial<FollowupMemory>;
  const txt = String(message ?? "");
  const promises = [...(base.promises ?? [])];
  if (/\b(demain|je reviens|je vous renvoie|je t'envoie|je te renvoie|je vérifie)\b/i.test(txt)) {
    promises.unshift(txt.trim().slice(0, 120));
  }
  return {
    promises: Array.from(new Set(promises)).slice(0, 12),
    plannedFollowups: Array.from(new Set([...(base.plannedFollowups ?? []), state?.automation?.nextFollowupAt ?? ""])).filter(Boolean).slice(0, 12),
    productInterest: Array.from(new Set([...(base.productInterest ?? []), ...(state?.productMemory?.viewedProducts ?? [])])).slice(0, 16),
    implicitCart: Array.from(new Set([...(base.implicitCart ?? []), state?.productMemory?.lastProductFocus ?? ""])).filter(Boolean).slice(0, 10),
    updatedAt: Date.now(),
  };
}

