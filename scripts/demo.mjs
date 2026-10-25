#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const commands = [
  ["suggest-commit", "Suggest a Conventional Commit from staged changes"],
  ["generate-changelog", "Generate categorized notes from Git history"],
  ["suggest-readme", "Suggest README updates from staged changes"],
];

console.log("RepoPilot AI demo");
console.log("Prerequisites: stage a meaningful diff, start Ollama, and pull qwen2.5-coder:7b.");

for (const [command, description] of commands) {
  console.log(`\n> ${command} - ${description}`);
  const result = spawnSync(
    process.execPath,
    ["dist/cli.js", command],
    { stdio: "inherit", windowsHide: true },
  );
  if (result.error) {
    console.error(`Unable to run ${command}: ${result.error.message}`);
    process.exitCode = 1;
    break;
  }
  if (result.status !== 0) {
    console.error(`${command} exited with status ${result.status ?? "unknown"}.`);
    process.exitCode = result.status ?? 1;
    break;
  }
}
