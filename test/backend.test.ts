import { describe, expect, it, vi } from "vitest";
import { CodexBackend, type ProcessRunner } from "../src/backend.js";
import type { OperationalError } from "../src/errors.js";

describe("CodexBackend", () => {
  it("runs Codex non-interactively with a read-only sandbox", async () => {
    const runner = vi.fn<ProcessRunner>().mockResolvedValue({
      stdout: '{"ok":true}',
      stderr: "",
    });
    const backend = new CodexBackend("gpt-5.6", "/repo", "codex", runner);

    await expect(backend.run("Return JSON")).resolves.toBe('{"ok":true}');
    expect(runner).toHaveBeenCalledWith(
      "codex",
      [
        "exec",
        "--ephemeral",
        "--model",
        "gpt-5.6",
        "--sandbox",
        "read-only",
        "--color",
        "never",
        "-",
      ],
      { cwd: "/repo", input: "Return JSON" },
    );
  });

  it("returns an actionable error when Codex is missing", async () => {
    const missingError = Object.assign(new Error("spawn codex ENOENT"), {
      code: "ENOENT",
    });
    const runner = vi.fn<ProcessRunner>().mockRejectedValue(missingError);
    const backend = new CodexBackend("gpt-5.6", "/repo", "codex", runner);

    await expect(backend.run("prompt")).rejects.toMatchObject({
      name: "OperationalError",
      exitCode: 2,
    } satisfies Partial<OperationalError>);
  });
});
