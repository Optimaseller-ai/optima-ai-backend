import "server-only";

import { openRouterEmbed } from "@/lib/ai/openrouter";
import { searchBusinessKnowledge } from "@/lib/business-knowledge";
import { formatCompactProductLines } from "@/lib/business-knowledge/slice-formatters";

function logCtx(event: string, payload: Record<string, unknown>) {
  console.log("[OPTIMA_AI_BUSINESS_CONTEXT]", event, payload);
}

/** Catalogue produits + settings + FAQ + RAG — contexte métier pour relances. */
export async function getBusinessContext(userId: string, query: string) {
  const started = Date.now();
  const q = query.trim();
  if (!q) {
    logCtx("empty_query", { userId, ms: Date.now() - started });
    return { kind: "empty" as const, context: "" };
  }

  let queryEmbedding: number[] | undefined;
  try {
    queryEmbedding = (await openRouterEmbed({ input: q })) as number[];
  } catch (e) {
    console.error("[OPTIMA_AI_ERROR]", e);
  }

  const search = await searchBusinessKnowledge({
    userId,
    prospectMessage: q,
    maxProducts: 6,
    includeVectorChunks: true,
    queryEmbedding,
  });

  if (search.products.length > 0) {
    const block = formatCompactProductLines(search.products, "fr");
    logCtx("products_hit", { userId, ms: Date.now() - started, count: search.products.length });
    return { kind: "products" as const, context: block };
  }

  if (search.documentChunks.length > 0) {
    const excerpt = search.documentChunks
      .slice(0, 4)
      .map((text, i) => `- Extrait ${i + 1}:\n${text}`)
      .join("\n\n");
    logCtx("documents_built", { userId, ms: Date.now() - started, excerptChars: excerpt.length });
    return { kind: "documents" as const, context: excerpt ? `Documents (extraits pertinents):\n${excerpt}` : "" };
  }

  logCtx("knowledge_empty", { userId, ms: Date.now() - started });
  return { kind: "empty" as const, context: "" };
}
