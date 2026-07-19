import { describe, expect, it, vi } from "vitest";
import {
  AntigravityBackend,
  ClaudeCodeBackend,
  CodexBackend,
  createBackend,
  OpenCodeBackend,
  type ProcessRunner,
  verifierConfig,
} from "../src/backend.js";
import type { OperationalError } from "../src/errors.js";

describe("CodexBackend", () => {
  it("runs Codex non-interactively with a read-only sandbox", async () => {
    const runner = vi.fn<ProcessRunner>().mockResolvedValue({
      stdout: '{"ok":true}',
      stderr: "",
    });
    const backend = new CodexBackend("gpt-5.6-sol", "/repo", "codex", runner);

    await expect(backend.run("Return JSON")).resolves.toBe('{"ok":true}');
    expect(runner).toHaveBeenCalledWith(
      "codex",
      [
        "exec",
        "--ephemeral",
        "--model",
        "gpt-5.6-sol",
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
    const backend = new CodexBackend("gpt-5.6-sol", "/repo", "codex", runner);

    await expect(backend.run("prompt")).rejects.toMatchObject({
      name: "OperationalError",
      exitCode: 2,
    } satisfies Partial<OperationalError>);
  });
});

describe("OpenCodeBackend", () => {
  it("runs OpenCode non-interactively with all tools denied", async () => {
    const runner = vi.fn<ProcessRunner>().mockResolvedValue({
      stdout: '{"ok":true}',
      stderr: "",
    });
    const backend = new OpenCodeBackend(
      "anthropic/claude-sonnet-4-6",
      "/repo",
      "opencode",
      runner,
    );

    await expect(backend.run("Return JSON")).resolves.toBe('{"ok":true}');
    expect(runner).toHaveBeenCalledWith(
      "opencode",
      [
        "--pure",
        "run",
        "--model",
        "anthropic/claude-sonnet-4-6",
        "Return JSON",
      ],
      {
        cwd: "/repo",
        input: "",
        env: { OPENCODE_PERMISSION: '{"*":"deny"}' },
      },
    );
  });
});

describe("ClaudeCodeBackend", () => {
  it("runs Claude Code in stateless print mode without tools", async () => {
    const runner = vi.fn<ProcessRunner>().mockResolvedValue({
      stdout: '{"ok":true}',
      stderr: "",
    });
    const backend = new ClaudeCodeBackend("sonnet", "/repo", "claude", runner);

    await expect(backend.run("Return JSON")).resolves.toBe('{"ok":true}');
    expect(runner).toHaveBeenCalledWith(
      "claude",
      [
        "-p",
        "--output-format",
        "text",
        "--no-session-persistence",
        "--tools",
        "",
        "--disallowedTools",
        "mcp__*",
        "--model",
        "sonnet",
        "Return JSON",
      ],
      { cwd: "/repo", input: "" },
    );
  });
});

describe("AntigravityBackend", () => {
  it("runs Antigravity non-interactively with a read-only instruction", async () => {
    const runner = vi.fn<ProcessRunner>().mockResolvedValue({
      stdout: '{"ok":true}',
      stderr: "",
    });
    const backend = new AntigravityBackend(
      "Gemini 3.5 Flash (Low)",
      "/repo",
      "agy",
      runner,
    );

    await expect(backend.run("Return JSON")).resolves.toBe('{"ok":true}');
    expect(runner).toHaveBeenCalledWith(
      "agy",
      [
        "--model",
        "Gemini 3.5 Flash (Low)",
        "-p",
        "Do not use tools or modify files. Work only from the supplied prompt.\n\nReturn JSON",
      ],
      { cwd: "/repo", input: "" },
    );
  });
});

describe("createBackend", () => {
  it.each([
    ["codex", CodexBackend],
    ["opencode", OpenCodeBackend],
    ["claude-code", ClaudeCodeBackend],
    ["antigravity", AntigravityBackend],
  ] as const)("creates the %s adapter", (backendName, BackendClass) => {
    const backend = createBackend(
      { backend: backendName, model: null, prdPath: null },
      "/repo",
    );

    expect(backend).toBeInstanceOf(BackendClass);
  });

  it("resolves an independent verifier harness and model", () => {
    expect(
      verifierConfig({
        backend: "codex",
        model: "gpt-builder",
        verifierBackend: "claude-code",
        verifierModel: "sonnet-verifier",
        prdPath: null,
      }),
    ).toMatchObject({
      backend: "claude-code",
      model: "sonnet-verifier",
    });
  });

  it("names the missing selected harness in operational errors", async () => {
    const missingError = Object.assign(new Error("spawn opencode ENOENT"), {
      code: "ENOENT",
    });
    const runner = vi.fn<ProcessRunner>().mockRejectedValue(missingError);
    const backend = createBackend(
      { backend: "opencode", model: null, prdPath: null },
      "/repo",
      runner,
    );

    await expect(backend.run("prompt")).rejects.toMatchObject({
      name: "OperationalError",
      exitCode: 2,
      message:
        "OpenCode CLI not found; install it and ensure `opencode` is on PATH",
    } satisfies Partial<OperationalError>);
  });
});
