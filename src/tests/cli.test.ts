import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("CLI exposes the changelog command without contacting Ollama", async () => {
  const result = await execFileAsync(
    process.execPath,
    ["dist/cli.js", "generate-changelog", "--help"],
    { windowsHide: true },
  );
  assert.match(result.stdout, /Generate categorized release notes/);
  assert.match(result.stdout, /--since <ref>/);
  assert.match(result.stdout, /--json/);
});

test("CLI help exposes all three commands", async () => {
  const result = await execFileAsync(process.execPath, ["dist/cli.js", "--help"], {
    windowsHide: true,
  });
  assert.match(result.stdout, /suggest-commit/);
  assert.match(result.stdout, /generate-changelog/);
  assert.match(result.stdout, /suggest-readme/);
});

test("CLI exposes README options without contacting Ollama", async () => {
  const result = await execFileAsync(
    process.execPath,
    ["dist/cli.js", "suggest-readme", "--help"],
    { windowsHide: true },
  );
  assert.match(result.stdout, /Suggest targeted README updates/);
  assert.match(result.stdout, /--max-diff-chars <number>/);
  assert.match(result.stdout, /--json/);
});
