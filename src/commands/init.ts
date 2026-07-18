import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { OperationalError } from "../errors.js";
import { findGitRoot } from "../git.js";
import { formatJson } from "../json.js";
import type { Config, State } from "../schemas.js";

const DEFAULT_MODEL = "gpt-5.6";

export async function initCommand(cwd: string): Promise<string> {
  const root = await findGitRoot(cwd);
  const driftwatchDirectory = join(root, ".driftwatch");

  try {
    await mkdir(driftwatchDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new OperationalError(
        ".driftwatch already exists; initialization did not overwrite it",
        { cause: error },
      );
    }
    throw new OperationalError("could not create .driftwatch directory", {
      cause: error,
    });
  }

  const config: Config = {
    backend: "codex",
    model: DEFAULT_MODEL,
    prdPath: null,
  };
  const state: State = {};

  try {
    await Promise.all([
      writeFile(join(driftwatchDirectory, "config.json"), formatJson(config), {
        flag: "wx",
      }),
      writeFile(join(driftwatchDirectory, "state.json"), formatJson(state), {
        flag: "wx",
      }),
    ]);
  } catch (error) {
    throw new OperationalError("could not write Driftwatch state files", {
      cause: error,
    });
  }

  return driftwatchDirectory;
}
