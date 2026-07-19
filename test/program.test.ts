import { describe, expect, it } from "vitest";
import { createProgram } from "../src/program.js";

describe("createProgram", () => {
  it("exposes exactly the four v1 commands", () => {
    const commandNames = createProgram("/repo").commands.map((command) =>
      command.name(),
    );

    expect(commandNames).toEqual(["init", "ingest", "check", "report"]);
  });

  it("offers every supported inference harness during init", () => {
    const init = createProgram("/repo").commands.find(
      (command) => command.name() === "init",
    );
    const backendOption = init?.options.find(
      (option) => option.long === "--backend",
    );

    expect(backendOption?.argChoices).toEqual([
      "codex",
      "opencode",
      "claude-code",
      "antigravity",
    ]);
    expect(init?.options.some((option) => option.long === "--model")).toBe(
      true,
    );
    expect(
      init?.options.find((option) => option.long === "--verifier-backend")
        ?.argChoices,
    ).toEqual(["codex", "opencode", "claude-code", "antigravity"]);
    expect(
      init?.options.some((option) => option.long === "--verifier-model"),
    ).toBe(true);
  });

  it("offers read-only JSON output for CI checks", () => {
    const check = createProgram("/repo").commands.find(
      (command) => command.name() === "check",
    );

    expect(check?.options.some((option) => option.long === "--ci")).toBe(true);
    expect(check?.options.some((option) => option.long === "--base")).toBe(
      true,
    );
  });
});
