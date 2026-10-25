#!/usr/bin/env node
import { Command } from "commander";
import { getCachedDiff, getGitHistory } from "./git.js";
import {
  generateCommitSuggestion,
  formatCommitSuggestion,
} from "./commit-generator.js";
import { LocalOllamaClient } from "./ollama.js";
import { RepoPilotError } from "./errors.js";
import { formatChangelog, generateChangelog } from "./changelog-generator.js";
import {
  formatReadmeSuggestions,
  generateReadmeSuggestions,
  readRepositoryReadme,
} from "./readme-assistant.js";

declare const process: { exitCode?: number };

const program = new Command()
  .name("repopilot")
  .description("Offline-first Git chore automation using a local Ollama model.")
  .version("0.1.0");

program
  .command("suggest-commit")
  .description(
    "Suggest one Conventional Commit message from git diff --cached.",
  )
  .option("-m, --model <model>", "Ollama model", "qwen2.5-coder:7b")
  .option(
    "--ollama-url <url>",
    "Local Ollama base URL",
    "http://127.0.0.1:11434",
  )
  .option(
    "--max-diff-chars <number>",
    "Maximum staged diff sent to Ollama",
    "12000",
  )
  .option("--json", "Print the validated JSON suggestion")
  .action(
    async (options: {
      model: string;
      ollamaUrl: string;
      maxDiffChars: string;
      json?: boolean;
    }) => {
      const maxDiffChars = Number(options.maxDiffChars);
      if (!Number.isInteger(maxDiffChars) || maxDiffChars < 1) {
        throw new RepoPilotError(
          "--max-diff-chars must be a positive integer.",
        );
      }
      const suggestion = await generateCommitSuggestion(
        await getCachedDiff(),
        new LocalOllamaClient(options.ollamaUrl),
        options.model,
        maxDiffChars,
      );
      console.log(
        options.json
          ? JSON.stringify(suggestion, null, 2)
          : formatCommitSuggestion(suggestion),
      );
    },
  );

program
  .command("generate-changelog")
  .description("Generate categorized release notes from Git commit history.")
  .option("--since <ref>", "Git reference; notes include commits after it")
  .option("--max-commits <number>", "Maximum commits to inspect", "100")
  .option("-m, --model <model>", "Ollama model", "qwen2.5-coder:7b")
  .option(
    "--ollama-url <url>",
    "Local Ollama base URL",
    "http://127.0.0.1:11434",
  )
  .option("--json", "Print structured JSON")
  .action(
    async (options: {
      since?: string;
      maxCommits: string;
      model: string;
      ollamaUrl: string;
      json?: boolean;
    }) => {
      const maxCommits = Number(options.maxCommits);
      if (!Number.isInteger(maxCommits) || maxCommits < 1 || maxCommits > 500) {
        throw new RepoPilotError(
          "--max-commits must be an integer from 1 to 500.",
        );
      }
      const changelog = await generateChangelog(
        await getGitHistory(options.since, maxCommits),
        new LocalOllamaClient(options.ollamaUrl),
        options.model,
      );

      console.log(
        options.json
          ? JSON.stringify(changelog, null, 2)
          : formatChangelog(changelog),
      );
    },
  );

program
  .command("suggest-readme")
  .description("Suggest targeted README updates from the staged Git diff.")
  .option("-m, --model <model>", "Ollama model", "qwen2.5-coder:7b")
  .option(
    "--ollama-url <url>",
    "Local Ollama base URL",
    "http://127.0.0.1:11434",
  )
  .option(
    "--max-diff-chars <number>",
    "Maximum staged diff sent to Ollama",
    "12000",
  )
  .option("--json", "Print the validated JSON suggestions")
  .action(
    async (options: {
      model: string;
      ollamaUrl: string;
      maxDiffChars: string;
      json?: boolean;
    }) => {
      const maxDiffChars = Number(options.maxDiffChars);
      if (!Number.isInteger(maxDiffChars) || maxDiffChars < 1) {
        throw new RepoPilotError(
          "--max-diff-chars must be a positive integer.",
        );
      }
      const suggestions = await generateReadmeSuggestions(
        await readRepositoryReadme(),
        await getCachedDiff(),
        new LocalOllamaClient(options.ollamaUrl),
        options.model,
        maxDiffChars,
      );
      console.log(
        options.json
          ? JSON.stringify(suggestions, null, 2)
          : formatReadmeSuggestions(suggestions),
      );
    },
  );

try {
  await program.parseAsync();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}
