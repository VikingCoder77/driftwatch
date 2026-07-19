import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { initCommand } from "../src/commands/init.js";
import { OperationalError } from "../src/errors.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

async function createRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "driftwatch-test-"));
  temporaryDirectories.push(directory);
  await execFileAsync("git", ["init", "--quiet"], { cwd: directory });
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("initCommand", () => {
  it("creates config and empty state at the Git root", async () => {
    const repository = await createRepository();
    const nestedDirectory = join(repository, "nested");
    await mkdir(nestedDirectory);

    const createdDirectory = await initCommand(nestedDirectory);

    expect(createdDirectory).toBe(
      join(await realpath(repository), ".driftwatch"),
    );
    const config = JSON.parse(
      await readFile(join(createdDirectory, "config.json"), "utf8"),
    );
    const state = JSON.parse(
      await readFile(join(createdDirectory, "state.json"), "utf8"),
    );
    expect(config).toEqual({
      backend: "codex",
      model: "gpt-5.6-sol",
      verifierBackend: null,
      verifierModel: null,
      prdPath: null,
    });
    expect(state).toEqual({ waivers: {} });
  });

  it("does not overwrite an existing Driftwatch directory", async () => {
    const repository = await createRepository();
    const driftwatchDirectory = join(repository, ".driftwatch");
    await mkdir(driftwatchDirectory);
    const marker = join(driftwatchDirectory, "keep.txt");
    await writeFile(marker, "keep");

    await expect(initCommand(repository)).rejects.toBeInstanceOf(
      OperationalError,
    );
    await expect(readFile(marker, "utf8")).resolves.toBe("keep");
  });

  it.each(["opencode", "claude-code", "antigravity"] as const)(
    "uses the %s harness default model",
    async (backend) => {
      const repository = await createRepository();

      const createdDirectory = await initCommand(repository, { backend });
      const config = JSON.parse(
        await readFile(join(createdDirectory, "config.json"), "utf8"),
      );

      expect(config).toEqual({
        backend,
        model: null,
        verifierBackend: null,
        verifierModel: null,
        prdPath: null,
      });
    },
  );

  it("stores an explicitly selected harness model", async () => {
    const repository = await createRepository();

    const createdDirectory = await initCommand(repository, {
      backend: "claude-code",
      model: "sonnet",
    });
    const config = JSON.parse(
      await readFile(join(createdDirectory, "config.json"), "utf8"),
    );

    expect(config).toEqual({
      backend: "claude-code",
      model: "sonnet",
      verifierBackend: null,
      verifierModel: null,
      prdPath: null,
    });
  });
});
