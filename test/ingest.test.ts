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

async function writeState(
  directory: string,
  fileName: string,
  value: unknown,
): Promise<void> {
  await writeFile(
    join(directory, ".driftwatch", fileName),
    `${JSON.stringify(value, null, 2)}\n`,
  );
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
    expect(summary).toEqual({
      claimCount: 1,
      commit,
      changes: { added: 1, changed: 0, removed: 0, unchanged: 0 },
    });
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

  it("carries claim identity across PRD revisions and prunes stale waivers", async () => {
    const repository = await createCommittedRepository();
    await writeState(repository, "claims.json", [
      {
        id: "C7",
        section: "Service",
        text: "The handler returns pong.",
        type: "behavior",
        sourceId: "R1",
      },
      {
        id: "C8",
        section: "Legacy",
        text: "The legacy endpoint exists.",
        type: "api-contract",
        sourceId: "R2",
      },
    ]);
    const head = (
      await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repository })
    ).stdout.trim();
    await writeState(repository, "state.json", {
      waivers: {
        C7: { rationale: "Temporary migration.", waivedAtCommit: head },
        C8: { rationale: "Legacy exception.", waivedAtCommit: head },
      },
    });
    const backend = new SequenceBackend([
      JSON.stringify([
        {
          id: "C1",
          section: "Service",
          text: "The handler returns ready.",
          type: "behavior",
          sourceId: "R1",
        },
        {
          id: "C2",
          section: "Health",
          text: "The health endpoint returns ok.",
          type: "api-contract",
          sourceId: "R3",
        },
      ]),
      JSON.stringify({
        status: "SATISFIED",
        file: "service.ts",
        lines: "1-1",
        evidence: "The handler is present.",
      }),
      JSON.stringify({
        status: "NOT_FOUND",
        file: null,
        lines: null,
        evidence: "No health endpoint exists.",
      }),
    ]);

    const summary = await ingestCommand(repository, "PRD.md", {
      createBackend: () => backend,
    });

    expect(summary.changes).toEqual({
      added: 1,
      changed: 1,
      removed: 1,
      unchanged: 0,
    });
    const storedClaims = JSON.parse(
      await readFile(join(repository, ".driftwatch/claims.json"), "utf8"),
    );
    expect(storedClaims.map(({ id }: { id: string }) => id)).toEqual([
      "C7",
      "C9",
    ]);
    const state = JSON.parse(
      await readFile(join(repository, ".driftwatch/state.json"), "utf8"),
    );
    expect(state.waivers).toEqual({
      C7: { rationale: "Temporary migration.", waivedAtCommit: head },
    });
  });

  it("extracts with the builder and verifies with a different model", async () => {
    const repository = await createCommittedRepository();
    await writeState(repository, "config.json", {
      backend: "codex",
      model: "gpt-builder",
      verifierBackend: "claude-code",
      verifierModel: "sonnet-verifier",
      prdPath: null,
    });
    const builder = new SequenceBackend([
      JSON.stringify([
        {
          id: "C1",
          section: "Service",
          text: "The handler returns pong.",
          type: "behavior",
          sourceId: "R1",
        },
      ]),
    ]);
    const verifier = new SequenceBackend([
      JSON.stringify({
        status: "SATISFIED",
        file: "service.ts",
        lines: "1-1",
        evidence: "The handler directly returns pong.",
      }),
    ]);
    const selections: string[] = [];

    await ingestCommand(repository, "PRD.md", {
      createBackend: (config, _root, role) => {
        selections.push(`${role}:${config.backend}:${config.model}`);
        return role === "builder" ? builder : verifier;
      },
    });

    expect(selections).toEqual([
      "builder:codex:gpt-builder",
      "verifier:claude-code:sonnet-verifier",
    ]);
    expect(builder.prompts).toHaveLength(1);
    expect(verifier.prompts).toHaveLength(1);
  });
});
