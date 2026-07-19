import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { OperationalError } from "../errors.js";
import { findGitRoot } from "../git.js";
import { formatJson } from "../json.js";
import type { BackendName, Config, State } from "../schemas.js";

const DEFAULT_MODELS: Record<BackendName, string | null> = {
  codex: "gpt-5.6-sol",
  opencode: null,
  "claude-code": null,
  antigravity: null,
};

export interface InitOptions {
  backend?: BackendName;
  model?: string;
  verifierBackend?: BackendName;
  verifierModel?: string;
}

export async function initCommand(
  cwd: string,
  options: InitOptions = {},
): Promise<string> {
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

  const backend = options.backend ?? "codex";
  const config: Config = {
    backend,
    model: options.model ?? DEFAULT_MODELS[backend],
    verifierBackend: options.verifierBackend ?? null,
    verifierModel: options.verifierModel ?? null,
    prdPath: null,
  };
  const state: State = { waivers: {} };

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
