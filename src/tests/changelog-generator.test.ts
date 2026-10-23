import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChangelogPrompt,
  formatChangelog,
  generateChangelog,
  parseChangelog,
} from "../changelog-generator.js";
import { RepoPilotError } from "../errors.js";
import type { GitCommit } from "../git.js";

const commits: GitCommit[] = [
  { hash: "abc123", subject: "add export command", body: "" },
  { hash: "def456", subject: "fix empty input", body: "Guard the parser." },
];

test("parses and formats cited categorized notes", () => {
  const changelog = parseChangelog(
    '{"Added":[{"text":"Added export command","commits":["abc123"]}],"Changed":[],"Fixed":[{"text":"Handle empty input","commits":["def456"]}],"Removed":[]}',
    commits,
  );
  assert.match(formatChangelog(changelog), /## Added/);
  assert.match(formatChangelog(changelog), /- Handle empty input/);
});

test("rejects malformed or uncited model output", () => {
  assert.throws(() => parseChangelog("not json", commits), RepoPilotError);
  assert.throws(
    () =>
      parseChangelog(
        '{"Added":[{"text":"invented feature","commits":["unknown"]}],"Changed":[],"Fixed":[],"Removed":[]}',
        commits,
      ),
    /supplied commit hashes/,
  );
});

test("bounds the model input to the requested commit list", async () => {
  let prompt = "";
  const result = await generateChangelog(commits, {
    generate: async (value) => {
      prompt = value;
      return '{"Added":[],"Changed":[],"Fixed":[],"Removed":[]}';
    },
  });
  assert.deepEqual(result, { Added: [], Changed: [], Fixed: [], Removed: [] });
  assert.match(prompt, /abc123/);
  assert.match(buildChangelogPrompt(commits), /<commits>/);
});

test("does not call Ollama for empty history", async () => {
  let called = false;
  await assert.rejects(
    generateChangelog([], {
      generate: async () => {
        called = true;
        return "";
      },
    }),
    /No Git commits/,
  );
  assert.equal(called, false);
});
