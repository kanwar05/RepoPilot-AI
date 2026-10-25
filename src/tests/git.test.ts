import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { getCachedDiff } from "../git.js";

const execFileAsync = promisify(execFile);

test("reads only staged changes using a repository working directory", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "repopilot-git-"));
  try {
    await execFileAsync("git", ["init"], { cwd, windowsHide: true });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd, windowsHide: true });
    await execFileAsync("git", ["config", "user.name", "RepoPilot Test"], { cwd, windowsHide: true });
    await writeFile(join(cwd, "tracked.txt"), "staged\n", "utf8");
    await execFileAsync("git", ["add", "--", "tracked.txt"], { cwd, windowsHide: true });
    await writeFile(join(cwd, "unstaged.txt"), "not staged\n", "utf8");

    const diff = await getCachedDiff(cwd);
    assert.match(diff, /tracked\.txt/);
    assert.doesNotMatch(diff, /unstaged\.txt/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
