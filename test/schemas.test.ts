import { describe, expect, it } from "vitest";
import { ConfigSchema } from "../src/schemas.js";

describe("ConfigSchema", () => {
  it("keeps existing Codex configurations valid", () => {
    const config = {
      backend: "codex",
      model: "gpt-5.6-sol",
      prdPath: "PRD.md",
    };

    expect(ConfigSchema.parse(config)).toEqual({
      ...config,
      verifierBackend: null,
      verifierModel: null,
    });
  });

  it.each(["opencode", "claude-code", "antigravity"] as const)(
    "allows %s to use its configured default model",
    (backend) => {
      const config = { backend, model: null, prdPath: null };

      expect(ConfigSchema.parse(config)).toEqual({
        ...config,
        verifierBackend: null,
        verifierModel: null,
      });
    },
  );

  it("rejects unknown harnesses and empty model names", () => {
    expect(
      ConfigSchema.safeParse({
        backend: "unknown",
        model: null,
        prdPath: null,
      }).success,
    ).toBe(false);
    expect(
      ConfigSchema.safeParse({
        backend: "opencode",
        model: "",
        prdPath: null,
      }).success,
    ).toBe(false);
  });

  it("accepts dedicated verifier routing", () => {
    const config = {
      backend: "codex",
      model: "gpt-5.6-sol",
      verifierBackend: "claude-code",
      verifierModel: "sonnet",
      prdPath: "PRD.md",
    };

    expect(ConfigSchema.parse(config)).toEqual(config);
  });
});
