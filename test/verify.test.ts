import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Backend } from "../src/backend.js";
import type { Claim } from "../src/schemas.js";
import { verifyClaim } from "../src/verify.js";

const temporaryDirectories: string[] = [];

class RecordingBackend implements Backend {
  readonly prompts: string[] = [];

  constructor(private readonly output: string) {}

  async run(prompt: string): Promise<string> {
    this.prompts.push(prompt);
    return this.output;
  }
}

const claim: Claim = {
  id: "C1",
  section: "Commands",
  text: "The command returns pong.",
  type: "behavior",
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("verifyClaim", () => {
  it("records NOT_FOUND without a model call when no candidate exists", async () => {
    const backend = new RecordingBackend("unused");

    await expect(verifyClaim("/repo", claim, [], backend)).resolves.toEqual({
      status: "NOT_FOUND",
      file: null,
      lines: null,
      evidence: "No repository files matched the claim's distinctive terms.",
    });
    expect(backend.prompts).toHaveLength(0);
  });

  it("verifies one claim against numbered candidate content", async () => {
    const directory = await mkdtemp(join(tmpdir(), "driftwatch-verify-"));
    temporaryDirectories.push(directory);
    await writeFile(
      join(directory, "service.ts"),
      'export const reply = "pong";\n',
    );
    const backend = new RecordingBackend(
      JSON.stringify({
        status: "SATISFIED",
        file: "service.ts",
        lines: "1-1",
        evidence: "The reply constant is pong.",
      }),
    );

    await expect(
      verifyClaim(
        directory,
        claim,
        [{ path: "service.ts", matchCount: 1 }],
        backend,
      ),
    ).resolves.toMatchObject({ status: "SATISFIED", file: "service.ts" });
    expect(backend.prompts[0]).toContain('1: export const reply = "pong";');
  });

  it("rejects evidence that cites a non-candidate file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "driftwatch-verify-"));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, "service.ts"), "pong\n");
    const backend = new RecordingBackend(
      JSON.stringify({
        status: "SATISFIED",
        file: "other.ts",
        lines: "1-1",
        evidence: "The other file satisfies it.",
      }),
    );

    await expect(
      verifyClaim(
        directory,
        claim,
        [{ path: "service.ts", matchCount: 1 }],
        backend,
      ),
    ).rejects.toMatchObject({ exitCode: 2 });
  });

  it.each(["SATISFIED", "VIOLATED"])(
    "downgrades %s results based only on documentation",
    async (status) => {
      const directory = await mkdtemp(join(tmpdir(), "driftwatch-verify-"));
      temporaryDirectories.push(directory);
      await writeFile(
        join(directory, "README.md"),
        "The command returns pong.\n",
      );
      const backend = new RecordingBackend(
        JSON.stringify({
          status,
          file: "README.md",
          lines: "1-1",
          evidence: "The README states that the command returns pong.",
        }),
      );

      await expect(
        verifyClaim(
          directory,
          claim,
          [{ path: "README.md", matchCount: 1 }],
          backend,
        ),
      ).resolves.toEqual({
        status: "NOT_FOUND",
        file: null,
        lines: null,
        evidence:
          "Only documentation matched; no direct implementation evidence was found.",
      });
    },
  );
});
