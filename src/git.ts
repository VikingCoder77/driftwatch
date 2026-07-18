import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { OperationalError } from "./errors.js";

const execFileAsync = promisify(execFile);

export async function findGitRoot(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "--show-toplevel"],
      { cwd, encoding: "utf8" },
    );
    return stdout.trim();
  } catch (error) {
    throw new OperationalError(
      "not a Git repository; run driftwatch inside a Git working tree",
      { cause: error },
    );
  }
}

export async function getCurrentCommit(root: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    });
    return stdout.trim();
  } catch (error) {
    throw new OperationalError(
      "could not read HEAD; create an initial Git commit and try again",
      { cause: error },
    );
  }
}
