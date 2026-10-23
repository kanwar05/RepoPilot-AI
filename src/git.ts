import { execFile } from "node:child_process";
import { promisify } from "util";
import { RepoPilotError } from "./errors.js";

const execFileAsync = promisify(execFile);

export interface GitCommit {
  hash: string;
  subject: string;
  body: string;
}

export async function getCachedDiff(): Promise<string> {
  try {
    const result = await execFileAsync(
      "git",
      ["diff", "--cached", "--no-ext-diff"],
      {
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true,
      },
    );
    return result.stdout;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RepoPilotError(
      `Unable to read the staged Git diff. Are you inside a Git repository?\n${detail}`,
    );
  }
}

const commitSeparator = "\x1e";
const fieldSeparator = "\x1f";

export async function getGitHistory(
  since: string | undefined,
  maxCommits: number,
): Promise<GitCommit[]> {
  if (!Number.isInteger(maxCommits) || maxCommits < 1 || maxCommits > 500) {
    throw new RepoPilotError("--max-commits must be an integer from 1 to 500.");
  }
  if (since !== undefined && !isSafeGitReference(since)) {
    throw new RepoPilotError(
      "--since must be a non-empty Git reference without whitespace or option prefixes.",
    );
  }

  const range = since ? `${since}..HEAD` : "HEAD";
  const args = [
    "log",
    "--no-ext-diff",
    "--no-decorate",
    "--format=%H%x1f%s%x1f%b%x1e",
    `--max-count=${maxCommits}`,
    range,
  ];
  try {
    if (since) {
      await execFileAsync("git", ["rev-parse", "--verify", `${since}^{commit}`], {
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
    }
    const result = await execFileAsync("git", args, {
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    });
    return parseGitHistory(result.stdout);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RepoPilotError(
      `Unable to read Git commit history. Check the repository and --since reference.\n${detail}`,
    );
  }
}

export function parseGitHistory(output: string): GitCommit[] {
  return output
    .split(commitSeparator)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, subject, ...bodyParts] = record.split(fieldSeparator);
      if (!hash || !subject) {
        throw new RepoPilotError("Git returned malformed commit history.");
      }
      return { hash, subject, body: bodyParts.join(fieldSeparator).trim() };
    });
}

function isSafeGitReference(value: string): boolean {
  return value.trim() === value && value.length > 0 && !/[\s\0]/.test(value) && !value.startsWith("-");
}
