import { describe, expect, it } from "vitest";
import { ModelOutputError } from "../src/errors.js";
import { extractFirstJsonValue, parseModelOutput } from "../src/json.js";
import { ClaimsSchema } from "../src/schemas.js";

describe("extractFirstJsonValue", () => {
  it("extracts a fenced JSON array surrounded by prose", () => {
    expect(
      extractFirstJsonValue('Result:\n```json\n[{"ok":true}]\n```\ndone'),
    ).toEqual([{ ok: true }]);
  });

  it("handles braces inside JSON strings", () => {
    expect(
      extractFirstJsonValue('before {"text":"use {braces}"} after'),
    ).toEqual({ text: "use {braces}" });
  });

  it("rejects output without a JSON object or array", () => {
    expect(() => extractFirstJsonValue("not json")).toThrow(ModelOutputError);
  });
});

describe("parseModelOutput", () => {
  it("validates claims against the exact schema", () => {
    const output = JSON.stringify([
      { id: "C1", section: "Commands", text: "Runs.", type: "cli" },
    ]);
    expect(parseModelOutput(output, ClaimsSchema)).toHaveLength(1);
  });

  it("rejects extra claim fields", () => {
    const output = JSON.stringify([
      {
        id: "C1",
        section: "Commands",
        text: "Runs.",
        type: "cli",
        extra: true,
      },
    ]);
    expect(() => parseModelOutput(output, ClaimsSchema)).toThrow(
      ModelOutputError,
    );
  });
});
