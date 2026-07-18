import { describe, expect, it } from "vitest";
import type { Backend } from "../src/backend.js";
import { OperationalError } from "../src/errors.js";
import { extractClaims } from "../src/extract.js";

class SequenceBackend implements Backend {
  readonly prompts: string[] = [];

  constructor(private readonly outputs: string[]) {}

  async run(prompt: string): Promise<string> {
    this.prompts.push(prompt);
    return this.outputs.shift() ?? "";
  }
}

const validClaims = JSON.stringify([
  {
    id: "C1",
    section: "Commands",
    text: "The CLI is named driftwatch.",
    type: "cli",
  },
]);

describe("extractClaims", () => {
  it("sends the full PRD and returns validated claims", async () => {
    const backend = new SequenceBackend([validClaims]);

    const claims = await extractClaims("# PRD\nComplete source text", backend);

    expect(claims[0]?.id).toBe("C1");
    expect(backend.prompts[0]).toContain("# PRD\nComplete source text");
    expect(backend.prompts[0]).toContain(
      "Do not split one numbered requirement into multiple claims.",
    );
    expect(backend.prompts[0]).toMatch(
      /Do not include Markdown fences or prose\.$/,
    );
  });

  it("retries exactly once after malformed output", async () => {
    const backend = new SequenceBackend(["invalid", validClaims]);

    await expect(extractClaims("PRD", backend)).resolves.toHaveLength(1);
    expect(backend.prompts).toHaveLength(2);
    expect(backend.prompts[1]).toContain("previous response was invalid");
  });

  it("fails operationally after the retry is invalid", async () => {
    const backend = new SequenceBackend(["invalid", "still invalid"]);

    await expect(extractClaims("PRD", backend)).rejects.toMatchObject({
      message: "Inference harness returned invalid claim JSON after one retry",
    });
    expect(backend.prompts).toHaveLength(2);
  });

  it("rejects duplicate claim identifiers", async () => {
    const duplicateClaims = JSON.stringify([
      JSON.parse(validClaims)[0],
      JSON.parse(validClaims)[0],
    ]);
    const backend = new SequenceBackend([duplicateClaims, duplicateClaims]);

    await expect(extractClaims("PRD", backend)).rejects.toBeInstanceOf(
      OperationalError,
    );
  });
});
