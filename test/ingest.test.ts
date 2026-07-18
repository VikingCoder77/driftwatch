import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import type { Backend } from "../src/backend.js";
import { ingestCommand } from "../src/commands/ingest.js";
import { initCommand } from "../src/commands/init.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

class SequenceBackend implements Backend {
  readonly prompts: string[] = [];

  constructor(private readonly outputs: string[]) {}

  async run(prompt: string): Promise<string> {
    this.prompts.push(prompt);
    return this.outputs.shift() ?? "";
  }
}

async function createCommittedRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "driftwatch-ingest-"));
  temporaryDirectories.push(directory);
  await execFileAsync("git", ["init", "--quiet"], { cwd: directory });
  await initCommand(directory);
  await writeFile(
    join(directory, "PRD.md"),
    "# Service\nThe handler returns pong.\n",
  );
  await writeFile(
    join(directory, "service.ts"),
    'export function handler() { return "pong"; }\n',
  );
  await execFileAsync("git", ["add", "."], { cwd: directory });
  await execFileAsync(
    "git",
    [
      "-c",
      "user.name=Driftwatch Tests",
      "-c",
      "user.email=tests@driftwatch.local",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
    { cwd: directory },
  );
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("ingestCommand", () => {
  it("extracts, searches, verifies, and persists claims at HEAD", async () => {
    const repository = await createCommittedRepository();
    const claims = JSON.stringify([
      {
        id: "C1",
        section: "Service",
        text: "The handler returns pong.",
        type: "behavior",
      },
    ]);
    const verification = JSON.stringify({
      status: "SATISFIED",
      file: "service.ts",
      lines: "1-1",
      evidence: "The handler directly returns pong.",
    });
    const backend = new SequenceBackend([claims, verification]);

    const summary = await ingestCommand(repository, "PRD.md", {
      createBackend: () => backend,
    });

    const commit = (
      await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repository })
    ).stdout.trim();
    expect(summary).toEqual({ claimCount: 1, commit });
    expect(backend.prompts).toHaveLength(2);
    const storedClaims = JSON.parse(
      await readFile(join(repository, ".driftwatch/claims.json"), "utf8"),
    );
    const mapping = JSON.parse(
      await readFile(join(repository, ".driftwatch/mapping.json"), "utf8"),
    );
    const config = JSON.parse(
      await readFile(join(repository, ".driftwatch/config.json"), "utf8"),
    );
    expect(storedClaims).toHaveLength(1);
    expect(mapping.C1).toMatchObject({
      status: "SATISFIED",
      file: "service.ts",
      checkedAtCommit: commit,
    });
    expect(config.prdPath).toBe("PRD.md");
  });

  it("does not replace stored claims when extraction fails", async () => {
    const repository = await createCommittedRepository();
    const claimsPath = join(repository, ".driftwatch/claims.json");
    await writeFile(claimsPath, '[{"existing":true}]\n');
    const backend = new SequenceBackend(["invalid", "still invalid"]);

    await expect(
      ingestCommand(repository, "PRD.md", {
        createBackend: () => backend,
      }),
    ).rejects.toMatchObject({ exitCode: 2 });
    await expect(readFile(claimsPath, "utf8")).resolves.toBe(
      '[{"existing":true}]\n',
    );
  });
});
