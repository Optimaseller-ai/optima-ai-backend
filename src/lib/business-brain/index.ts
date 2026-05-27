import "server-only";

export type { CatalogProductBrief } from "./context/catalog-types";
export type {
  ExtendedBusinessFacts,
  BusinessProfileLite,
  BusinessBrainComposeArgs,
} from "./context/business-brain-args";

export { composeBusinessBrainPromptBlock } from "./knowledge/business-knowledge-engine";
export { formatKnowledgePrioritySystemBlock } from "./knowledge/knowledge-priority";
export { formatAgentConfidenceSystemBlock } from "./knowledge/agent-confidence";
export { formatProductMemoryEngineBlock } from "./catalog/product-memory";
export { mapDbProductsToCatalogBrief } from "./catalog/map-products";
export {
  buildBusinessKnowledgeBase,
  buildServiceGroundedFallback,
  formatBusinessKnowledgeBaseBlock,
  type BusinessKnowledgeBase,
} from "./context/business-knowledge-base";
export { detectBusinessIntent, type BusinessIntentKind } from "./intent/business-intent-detector";
export { validateReplyAgainstBusinessContext, formatStrictNoHallucinationBlock } from "./grounding/strict-grounding";
