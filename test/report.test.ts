import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { initCommand } from "../src/commands/init.js";
import { reportCommand } from "../src/commands/report.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

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

describe("reportCommand", () => {
  it("prints and stores the same ordered Markdown report", async () => {
    const repository = await mkdtemp(join(tmpdir(), "driftwatch-report-"));
    temporaryDirectories.push(repository);
    await execFileAsync("git", ["init", "--quiet"], { cwd: repository });
    await initCommand(repository);
    await writeState(repository, "claims.json", [
      {
        id: "C1",
        section: "Satisfied",
        text: `A satisfied \`requirement\` ${"with enough detail ".repeat(8)}`,
        type: "behavior",
      },
      {
        id: "C2",
        section: "Violated",
        text: "The limit is 3 | exactly.",
        type: "limit",
      },
      {
        id: "C3",
        section: "Missing",
        text: "A missing command exists.",
        type: "cli",
      },
    ]);
    await writeState(repository, "mapping.json", {
      C1: {
        status: "SATISFIED",
        file: "src/ok.ts",
        lines: "2-4",
        evidence: "The implementation is present.",
        checkedAtCommit: "abc123",
      },
      C2: {
        status: "VIOLATED",
        file: "src/limit.ts",
        lines: "8-9",
        evidence: "The implementation sets the limit to 5.",
        checkedAtCommit: "abc123",
      },
      C3: {
        status: "NOT_FOUND",
        file: null,
        lines: null,
        evidence: "No matching command was found.",
        checkedAtCommit: "abc123",
      },
    });

    const report = await reportCommand(repository);

    expect(report.hasViolations).toBe(true);
    expect(report.content).toContain("Commit: `abc123`");
    expect(report.content).toContain(
      "Totals: ❌ 1 violated · ⚠️ 1 unimplemented · ✅ 1 satisfied",
    );
    expect(report.content).toContain("The limit is 3 \\| exactly.");
    expect(report.content).toContain("…");
    expect(report.content).not.toContain("`requirement`");
    expect(report.content.indexOf("## Violated")).toBeLessThan(
      report.content.indexOf("## Unimplemented"),
    );
    expect(report.content.indexOf("## Unimplemented")).toBeLessThan(
      report.content.indexOf("## Satisfied"),
    );
    await expect(
      readFile(join(repository, ".driftwatch/DRIFT.md"), "utf8"),
    ).resolves.toBe(report.content);
  });
});
