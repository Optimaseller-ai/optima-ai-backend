import { validateReplyAgainstBusinessContext, type GroundingValidationResult } from "@/lib/business-brain/grounding/strict-grounding";
import type { BusinessKnowledgeBase } from "@/lib/business-brain/context/business-knowledge-base";
import { stripAiSpeakerLabels } from "@/lib/chat/pipeline/strip-ai-labels";

export type ResponseValidationResult = GroundingValidationResult & {
  cleanedReply: string;
};

export function validateAndCleanOutgoingReply(args: {
  reply: string;
  userMessage: string;
  knowledgeBase: BusinessKnowledgeBase;
  agentName?: string;
}): ResponseValidationResult {
  let cleanedReply = stripAiSpeakerLabels(args.reply, args.agentName);
  const grounding = validateReplyAgainstBusinessContext({
    reply: cleanedReply,
    userMessage: args.userMessage,
    knowledgeBase: args.knowledgeBase,
  });

  return {
    ...grounding,
    cleanedReply,
  };
}
