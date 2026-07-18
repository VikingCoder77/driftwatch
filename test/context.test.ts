import { describe, expect, it } from "vitest";
import { selectRelevantContent } from "../src/context.js";

describe("selectRelevantContent", () => {
  it("adds stable one-based line numbers to small files", () => {
    expect(selectRelevantContent("first\nsecond", ["first"])).toBe(
      "1: first\n2: second",
    );
  });

  it("keeps only matching large-file context with forty surrounding lines", () => {
    const lines = Array.from(
      { length: 320 },
      (_, index) => `${String(index + 1).padStart(3, "0")} ${"x".repeat(90)}`,
    );
    lines[159] = `160 distinctiveToken ${"x".repeat(90)}`;

    const selected = selectRelevantContent(lines.join("\n"), [
      "distinctiveToken",
    ]);

    expect(selected).toContain("120: 120");
    expect(selected).toContain("160: 160 distinctiveToken");
    expect(selected).toContain("200: 200");
    expect(selected).not.toContain("119: 119");
    expect(selected).not.toContain("201: 201");
  });
});
