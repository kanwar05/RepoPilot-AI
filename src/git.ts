import { execFile } from "node:child_process";
import { promisify } from "util";
import { RepoPilotError } from "./errors.js";

const execFileAsync = promisify(execFile);

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
