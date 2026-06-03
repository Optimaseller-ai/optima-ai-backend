import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeHumanReplyScore,
  isEmojiOnlyReply,
  isValidHumanReply,
  validateHumanReply,
} from "./human-reply-validator.ts";

describe("human-reply-validator", () => {
  const invalid = ["🙂", "😂", "👍", "...", "??", "😂😂", ""];
  for (const reply of invalid) {
    it(`invalid: ${JSON.stringify(reply)}`, () => {
      assert.equal(isEmojiOnlyReply(reply), true, "emojiOnly");
      assert.equal(isValidHumanReply(reply), false, "valid");
      assert.ok(computeHumanReplyScore(reply) < 0.35, "score");
      assert.equal(validateHumanReply(reply).valid, false);
    });
  }

  const valid = ["Salut 🙂", "Bonsoir", "Oui ?", "Je vois 😄", "Cc 👋", "Ça marche 😄", "Hey salut"];
  for (const reply of valid) {
    it(`valid: ${JSON.stringify(reply)}`, () => {
      assert.equal(isValidHumanReply(reply), true, reply);
      assert.ok(computeHumanReplyScore(reply) >= 0.35, reply);
      assert.equal(validateHumanReply(reply).valid, true);
    });
  }
});
