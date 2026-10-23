import { RepoPilotError } from "./errors.js";
import type { GitCommit } from "./git.js";
import type { OllamaClient } from "./ollama.js";

export const changelogCategories = ["Added", "Changed", "Fixed", "Removed"] as const;
export type ChangelogCategory = (typeof changelogCategories)[number];

export interface ChangelogEntry {
  text: string;
  commits: string[];
}

export type Changelog = Record<ChangelogCategory, ChangelogEntry[]>;

export function buildChangelogPrompt(commits: GitCommit[]): string {
  const evidence = commits
    .map(
      (commit) =>
        `<commit hash="${commit.hash}">\nSubject: ${commit.subject}\nBody: ${commit.body || "(empty)"}\n</commit>`,
    )
    .join("\n");
  return [
    "Create release notes from only the supplied Git commits.",
    "Do not invent changes, infer unmentioned behavior, or include commits as prose.",
    "Categorize concrete changes into Added, Changed, Fixed, and Removed.",
    "Return JSON only with exactly this shape:",
    '{"Added":[{"text":"concise note","commits":["full hash"]}],"Changed":[],"Fixed":[],"Removed":[]}',
    "Every entry must cite one or more supplied commit hashes. Omit uncertain or purely administrative commits.",
    "<commits>",
    evidence,
    "</commits>",
  ].join("\n");
}

export function parseChangelog(raw: string, commits: GitCommit[]): Changelog {
  const withoutFence = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutFence);
  } catch {
    throw new RepoPilotError("Ollama returned malformed changelog JSON.");
  }
  if (!isRecord(parsed)) {
    throw new RepoPilotError("Ollama changelog must be a JSON object.");
  }
  const knownHashes = new Set(commits.map((commit) => commit.hash));
  const changelog = {} as Changelog;
  for (const category of changelogCategories) {
    const value = parsed[category];
    if (!Array.isArray(value)) {
      throw new RepoPilotError(`Ollama changelog field ${category} must be an array.`);
    }
    changelog[category] = value.map((entry) => {
      if (!isRecord(entry) || typeof entry.text !== "string" || !Array.isArray(entry.commits)) {
        throw new RepoPilotError(`Each ${category} entry needs text and commits.`);
      }
      if (!entry.commits.every((hash): hash is string => typeof hash === "string" && knownHashes.has(hash))) {
        throw new RepoPilotError(`${category} entries may cite only supplied commit hashes.`);
      }
      const text = entry.text.trim();
      if (!text || entry.commits.length === 0) {
        throw new RepoPilotError(`${category} entries cannot be empty or uncited.`);
      }
      return { text, commits: entry.commits };
    });
  }
  return changelog;
}

export async function generateChangelog(
  commits: GitCommit[],
  client: OllamaClient,
  model = "qwen2.5-coder:7b",
): Promise<Changelog> {
  if (commits.length === 0) {
    throw new RepoPilotError("No Git commits found for the requested history.");
  }
  return parseChangelog(await client.generate(buildChangelogPrompt(commits), model), commits);
}

export function formatChangelog(changelog: Changelog): string {
  return changelogCategories
    .map((category) => {
      const entries = changelog[category];
      return `## ${category}\n${entries.length ? entries.map((entry) => `- ${entry.text}`).join("\n") : "- None"}`
    })
    .join("\n\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
