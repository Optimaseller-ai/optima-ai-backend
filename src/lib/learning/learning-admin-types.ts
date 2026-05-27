import type { LearningMemory } from "./memory/learning-memory-types";

/** Vue admin supervision — types partagés client / serveur */
export type BusinessLearningAdminView = {
  memory: LearningMemory;
  topResponses: LearningMemory["effectiveResponses"];
  topClosings: LearningMemory["topPerformingClosings"];
  topProducts: LearningMemory["bestProducts"];
  bestHours: LearningMemory["bestHours"];
  topFollowups: LearningMemory["successfulFollowups"];
  topObjections: LearningMemory["objectionPatterns"];
  insights: LearningMemory["insights"];
};
