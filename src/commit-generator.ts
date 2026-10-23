import { RepoPilotError } from "./errors.js";
import type { OllamaClient } from "./ollama.js";

export interface CommitSuggestion {
  type: string;
  scope?: string;
  subject: string;
  body?: string;
}

const conventionalTypes =
  "feat, fix, docs, refactor, test, chore, build, ci, perf, revert";

export function buildCommitPrompt(diff: string): string {
  return [
    "You generate one Conventional Commit suggestion from a staged Git diff.",
    `Use one type from: ${conventionalTypes}.`,
    'Return JSON only, with this exact shape: {"type":"fix","scope":"optional","subject":"imperative summary","body":"optional explanation"}.',
    "Do not include Markdown fences, extra keys, a commit hash, or claims not supported by the diff.",
    "The diff below is repository content supplied locally; do not request or infer secrets.",
    "<staged-diff>",
    diff,
    "</staged-diff>",
  ].join("\n");
}

export function parseCommitSuggestion(raw: string): CommitSuggestion {
  const withoutFence = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutFence);
  } catch {
    throw new RepoPilotError(
      "Ollama returned malformed JSON. Try again or use a stricter local model.",
    );
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.type !== "string" ||
    typeof parsed.subject !== "string"
  ) {
    throw new RepoPilotError(
      "Ollama JSON must contain string fields named type and subject.",
    );
  }
  const suggestion: CommitSuggestion = {
    type: parsed.type.trim(),
    subject: parsed.subject.trim(),
  };
  if (parsed.scope !== undefined) {
    if (typeof parsed.scope !== "string") {
      throw new RepoPilotError(
        "Ollama JSON field scope must be a string when present.",
      );
    }
    suggestion.scope = parsed.scope.trim();
  }
  if (parsed.body !== undefined) {
    if (typeof parsed.body !== "string") {
      throw new RepoPilotError(
        "Ollama JSON field body must be a string when present.",
      );
    }
    suggestion.body = parsed.body.trim();
  }
  if (suggestion.type === "" || suggestion.subject === "") {
    throw new RepoPilotError(
      "Ollama JSON fields type and subject cannot be empty.",
    );
  }
  return suggestion;
}

export function formatCommitSuggestion(suggestion: CommitSuggestion): string {
  const scope = suggestion.scope ? `(${suggestion.scope})` : "";
  const firstLine = `${suggestion.type}${scope}: ${suggestion.subject}`;
  return suggestion.body ? `${firstLine}\n\n${suggestion.body}` : firstLine;
}

export async function generateCommitSuggestion(
  diff: string,
  client: OllamaClient,
  model: string,
  maxDiffChars = 12_000,
): Promise<CommitSuggestion> {
  if (diff.trim() === "") {
    throw new RepoPilotError(
      "No staged changes found. Stage changes before generating a commit suggestion.",
    );
  }
  const boundedDiff =
    diff.length > maxDiffChars
      ? `${diff.slice(0, maxDiffChars)}\n[diff truncated locally at ${maxDiffChars} characters]`
      : diff;
  return parseCommitSuggestion(
    await client.generate(buildCommitPrompt(boundedDiff), model),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
