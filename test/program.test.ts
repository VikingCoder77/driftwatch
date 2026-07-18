import { describe, expect, it } from "vitest";
import { createProgram } from "../src/program.js";

describe("createProgram", () => {
  it("exposes exactly the four v1 commands", () => {
    const commandNames = createProgram("/repo").commands.map((command) =>
      command.name(),
    );

    expect(commandNames).toEqual(["init", "ingest", "check", "report"]);
  });
});
