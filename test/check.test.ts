import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import type { Backend } from "../src/backend.js";
import { checkCommand } from "../src/commands/check.js";
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

async function git(directory: string, args: string[]): Promise<string> {
  return (
    await execFileAsync("git", args, { cwd: directory, encoding: "utf8" })
  ).stdout.trim();
}

async function commit(directory: string, message: string): Promise<string> {
  await git(directory, ["add", "."]);
  await git(directory, [
    "-c",
    "user.name=Driftwatch Tests",
    "-c",
    "user.email=tests@driftwatch.local",
    "commit",
    "--quiet",
    "-m",
    message,
  ]);
  return git(directory, ["rev-parse", "HEAD"]);
}

async function createRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "driftwatch-check-"));
  temporaryDirectories.push(directory);
  await git(directory, ["init", "--quiet"]);
  await initCommand(directory);
  return directory;
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

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("checkCommand", () => {
  it("performs a full mapping pass when no baseline commit exists", async () => {
    const repository = await createRepository();
    await writeFile(
      join(repository, "service.ts"),
      'export function handler() { return "pong"; }\n',
    );
    await writeState(repository, "claims.json", [
      {
        id: "C1",
        section: "Service",
        text: "The handler returns pong.",
        type: "behavior",
      },
    ]);
    await writeState(repository, "mapping.json", {
      C1: {
        status: "NOT_FOUND",
        file: null,
        lines: null,
        evidence: "Not mapped yet.",
        checkedAtCommit: "seed",
      },
    });
    const head = await commit(repository, "fixture");
    const backend = new SequenceBackend([
      JSON.stringify({
        status: "SATISFIED",
        file: "service.ts",
        lines: "1-1",
        evidence: "The handler directly returns pong.",
      }),
    ]);

    const summary = await checkCommand(repository, {
      createBackend: () => backend,
    });

    expect(summary).toEqual({
      checkedClaimCount: 1,
      commit: head,
      hasViolations: false,
    });
    expect(backend.prompts).toHaveLength(1);
    const state = JSON.parse(
      await readFile(join(repository, ".driftwatch/state.json"), "utf8"),
    );
    expect(state.lastCheckedCommit).toBe(head);
  });

  it("checks mapped changed claims and retries NOT_FOUND claims only", async () => {
    const repository = await createRepository();
    await writeFile(join(repository, "changed.ts"), "old handler\n");
    await writeFile(join(repository, "unchanged.ts"), "unsafe stable value\n");
    await writeState(repository, "claims.json", [
      {
        id: "C1",
        section: "Changed",
        text: "The changed handler returns pong.",
        type: "behavior",
      },
      {
        id: "C2",
        section: "Stable",
        text: "The stable value is safe.",
        type: "behavior",
      },
      {
        id: "C3",
        section: "New",
        text: "The new endpoint returns ready.",
        type: "behavior",
      },
    ]);
    await writeState(repository, "mapping.json", {
      C1: {
        status: "SATISFIED",
        file: "changed.ts",
        lines: "1-1",
        evidence: "Previously satisfied.",
        checkedAtCommit: "seed",
      },
      C2: {
        status: "VIOLATED",
        file: "unchanged.ts",
        lines: "1-1",
        evidence: "The value is unsafe.",
        checkedAtCommit: "seed",
      },
      C3: {
        status: "NOT_FOUND",
        file: null,
        lines: null,
        evidence: "No endpoint exists.",
        checkedAtCommit: "seed",
      },
    });
    const base = await commit(repository, "base");
    await writeState(repository, "state.json", { lastCheckedCommit: base });
    await writeState(repository, "mapping.json", {
      C1: {
        status: "SATISFIED",
        file: "changed.ts",
        lines: "1-1",
        evidence: "Previously satisfied.",
        checkedAtCommit: base,
      },
      C2: {
        status: "VIOLATED",
        file: "unchanged.ts",
        lines: "1-1",
        evidence: "The value is unsafe.",
        checkedAtCommit: base,
      },
      C3: {
        status: "NOT_FOUND",
        file: null,
        lines: null,
        evidence: "No endpoint exists.",
        checkedAtCommit: base,
      },
    });
    await writeFile(
      join(repository, "changed.ts"),
      'export const changedHandler = () => "pong";\n',
    );
    await writeFile(
      join(repository, "new.ts"),
      'export const newEndpoint = () => "ready";\n',
    );
    const head = await commit(repository, "change implementation");
    const backend = new SequenceBackend([
      JSON.stringify({
        status: "SATISFIED",
        file: "changed.ts",
        lines: "1-1",
        evidence: "The changed handler returns pong.",
      }),
      JSON.stringify({
        status: "SATISFIED",
        file: "new.ts",
        lines: "1-1",
        evidence: "The new endpoint returns ready.",
      }),
    ]);

    const summary = await checkCommand(repository, {
      createBackend: () => backend,
    });

    expect(summary).toEqual({
      checkedClaimCount: 2,
      commit: head,
      hasViolations: true,
    });
    expect(backend.prompts).toHaveLength(2);
    expect(backend.prompts[0]).not.toContain("unchanged.ts");
    const mapping = JSON.parse(
      await readFile(join(repository, ".driftwatch/mapping.json"), "utf8"),
    );
    expect(mapping.C1.checkedAtCommit).toBe(head);
    expect(mapping.C2).toMatchObject({
      status: "VIOLATED",
      checkedAtCommit: base,
    });
    expect(mapping.C3).toMatchObject({
      status: "SATISFIED",
      file: "new.ts",
      checkedAtCommit: head,
    });
  });

  it("limits a ten-file incremental diff to six backend calls", async () => {
    const repository = await createRepository();
    const identifiers = [
      "alphaLimit",
      "bravoLimit",
      "charlieLimit",
      "deltaLimit",
      "echoLimit",
      "foxtrotLimit",
    ];
    const claims = identifiers.map((identifier, index) => ({
      id: `C${index + 1}`,
      section: "Limits",
      text: `The ${identifier} constant is 10.`,
      type: "limit",
    }));

    for (let index = 0; index < 10; index += 1) {
      const identifier = identifiers[index] ?? `supportValue${index + 1}`;
      await writeFile(
        join(repository, `file${String(index + 1).padStart(2, "0")}.ts`),
        `export const ${identifier} = 10;\n`,
      );
    }
    await writeState(repository, "claims.json", claims);
    await writeState(
      repository,
      "mapping.json",
      Object.fromEntries(
        claims.map((claim, index) => [
          claim.id,
          {
            status: "SATISFIED",
            file: `file${String(index + 1).padStart(2, "0")}.ts`,
            lines: "1-1",
            evidence: "The constant is 10.",
            checkedAtCommit: "seed",
          },
        ]),
      ),
    );
    const base = await commit(repository, "base");

    for (let index = 0; index < 10; index += 1) {
      const fileName = `file${String(index + 1).padStart(2, "0")}.ts`;
      const identifier = identifiers[index] ?? `supportValue${index + 1}`;
      await writeFile(
        join(repository, fileName),
        `export const ${identifier} = 10;\nexport const revision${index + 1} = 2;\n`,
      );
    }
    await git(repository, ["add", "*.ts"]);
    await git(repository, [
      "-c",
      "user.name=Driftwatch Tests",
      "-c",
      "user.email=tests@driftwatch.local",
      "commit",
      "--quiet",
      "-m",
      "change ten files",
    ]);
    const head = await git(repository, ["rev-parse", "HEAD"]);
    await writeState(repository, "state.json", { lastCheckedCommit: base });
    await writeState(
      repository,
      "mapping.json",
      Object.fromEntries(
        claims.map((claim, index) => [
          claim.id,
          {
            status: "SATISFIED",
            file: `file${String(index + 1).padStart(2, "0")}.ts`,
            lines: "1-1",
            evidence: "The constant is 10.",
            checkedAtCommit: base,
          },
        ]),
      ),
    );
    const backend = new SequenceBackend(
      claims.map((claim, index) =>
        JSON.stringify({
          status: "SATISFIED",
          file: `file${String(index + 1).padStart(2, "0")}.ts`,
          lines: "1-1",
          evidence: `${claim.text} is implemented directly.`,
        }),
      ),
    );

    const changedFiles = (
      await git(repository, ["diff", "--name-only", `${base}..${head}`])
    ).split("\n");
    const summary = await checkCommand(repository, {
      createBackend: () => backend,
    });

    expect(changedFiles).toHaveLength(10);
    expect(summary).toEqual({
      checkedClaimCount: 6,
      commit: head,
      hasViolations: false,
    });
    expect(backend.prompts).toHaveLength(6);
  });
});
