import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCommitPrompt,
  formatCommitSuggestion,
  generateCommitSuggestion,
  parseCommitSuggestion
} from "../commit-generator.js";
import { RepoPilotError } from "../errors.js";

test("parses and formats a valid model response", () => {
  const suggestion = parseCommitSuggestion('{"type":"feat","scope":"cli","subject":"add commit suggestions","body":"Uses staged changes only."}');
  assert.equal(formatCommitSuggestion(suggestion), "feat(cli): add commit suggestions\n\nUses staged changes only.");
});

test("accepts a fenced JSON response", () => {
  assert.deepEqual(parseCommitSuggestion("```json\n{\"type\":\"fix\",\"subject\":\"handle empty diffs\"}\n```"), {
    type: "fix",
    subject: "handle empty diffs"
  });
});

test("rejects malformed model output", () => {
  assert.throws(() => parseCommitSuggestion("not json"), RepoPilotError);
  assert.throws(() => parseCommitSuggestion('{"type":"fix"}'), /type and subject/);
});

test("does not call Ollama for an empty diff", async () => {
  let called = false;
  await assert.rejects(
    generateCommitSuggestion("", { generate: async () => { called = true; return ""; } }, "qwen2.5-coder:7b"),
    /No staged changes/
  );
  assert.equal(called, false);
});

test("bounds large diffs before local model invocation", async () => {
  let prompt = "";
  const result = await generateCommitSuggestion("x".repeat(20), {
    generate: async (value) => { prompt = value; return '{"type":"refactor","subject":"simplify code"}'; }
  }, "qwen2.5-coder:7b", 10);
  assert.equal(result.type, "refactor");
  assert.match(prompt, /diff truncated locally at 10 characters/);
  assert.ok(prompt.includes("xxxxxxxxxx"));
});

test("prompt requires JSON and identifies the staged diff boundary", () => {
  const prompt = buildCommitPrompt("diff --git a/a.ts b/a.ts");
  assert.match(prompt, /Return JSON only/);
  assert.match(prompt, /<staged-diff>/);
});
