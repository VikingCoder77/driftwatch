import { describe, expect, it } from "vitest";
import { reconcileClaimIdentities } from "../src/identity.js";
import type { Claim } from "../src/schemas.js";

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: "C1",
    section: "Limits",
    text: "The limit is 3.",
    type: "limit",
    sourceId: "R1",
    ...overrides,
  };
}

describe("reconcileClaimIdentities", () => {
  it("preserves identity when a numbered requirement changes", () => {
    const result = reconcileClaimIdentities(
      [claim({ id: "C1", text: "The limit is 5." })],
      [claim({ id: "C8" })],
    );

    expect(result.claims[0]?.id).toBe("C8");
    expect(result.changes).toEqual({
      added: 0,
      changed: 1,
      removed: 0,
      unchanged: 0,
    });
  });

  it("falls back to normalized content and allocates monotonic identifiers", () => {
    const result = reconcileClaimIdentities(
      [
        claim({ id: "C1", sourceId: null, text: "The  limit is 3." }),
        claim({ id: "C2", sourceId: "R3", text: "The timeout is 10." }),
      ],
      [
        claim({ id: "C4", sourceId: null }),
        claim({ id: "C9", sourceId: "R2", text: "The retry count is 2." }),
      ],
    );

    expect(result.claims.map(({ id }) => id)).toEqual(["C4", "C10"]);
    expect(result.changes).toEqual({
      added: 1,
      changed: 1,
      removed: 1,
      unchanged: 0,
    });
  });
});
