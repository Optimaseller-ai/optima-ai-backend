import "server-only";

import {
  EMPTY_LEARNING_MEMORY,
  type LearningMemory,
} from "./learning-memory-types";

const memoryByBusiness = new Map<string, LearningMemory>();
const MAX_BUSINESSES = 500;

export function getLearningMemory(businessId: string): LearningMemory {
  return memoryByBusiness.get(businessId) ?? EMPTY_LEARNING_MEMORY(businessId);
}

export function setLearningMemory(memory: LearningMemory): void {
  memoryByBusiness.set(memory.businessId, memory);
  if (memoryByBusiness.size > MAX_BUSINESSES) {
    const first = memoryByBusiness.keys().next().value;
    if (first) memoryByBusiness.delete(first);
  }
}

export async function loadLearningMemoryFromDb(businessId: string): Promise<LearningMemory> {
  const cached = memoryByBusiness.get(businessId);
  if (cached && Date.now() - new Date(cached.updatedAt).getTime() < 60_000) {
    return cached;
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("learning_memory")
      .eq("id", businessId)
      .maybeSingle();

    const raw = (data as { learning_memory?: unknown } | null)?.learning_memory;
    if (raw && typeof raw === "object" && (raw as LearningMemory).businessId) {
      const mem = raw as LearningMemory;
      memoryByBusiness.set(businessId, mem);
      return mem;
    }
  } catch {
    // colonne absente ou pas migrée — mémoire volatile uniquement
  }

  const fresh = EMPTY_LEARNING_MEMORY(businessId);
  memoryByBusiness.set(businessId, fresh);
  return fresh;
}

export async function persistLearningMemory(memory: LearningMemory): Promise<void> {
  setLearningMemory(memory);
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ learning_memory: memory as unknown as Record<string, unknown> })
      .eq("id", memory.businessId);
  } catch {
    // persistance optionnelle
  }
}
