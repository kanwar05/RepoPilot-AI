#!/usr/bin/env node
import { Command } from "commander";
import { getCachedDiff } from "./git.js";
import {
  generateCommitSuggestion,
  formatCommitSuggestion,
} from "./commit-generator.js";
import { LocalOllamaClient } from "./ollama.js";
import { RepoPilotError } from "./errors.js";

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

try {
  await program.parseAsync();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}
