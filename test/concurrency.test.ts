import { describe, expect, it } from "vitest";
import { mapConcurrent } from "../src/concurrency.js";

describe("mapConcurrent", () => {
  it("limits active work and preserves input order", async () => {
    let active = 0;
    let maximumActive = 0;

    const results = await mapConcurrent([4, 3, 2, 1], 2, async (value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, value * 5));
      active -= 1;
      return value * 10;
    });

    expect(maximumActive).toBe(2);
    expect(results).toEqual([40, 30, 20, 10]);
  });

  it("stops scheduling new work after a failure", async () => {
    const started: number[] = [];

    await expect(
      mapConcurrent([1, 2, 3, 4, 5], 2, async (value) => {
        started.push(value);
        if (value === 2) {
          throw new Error("failed");
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        return value;
      }),
    ).rejects.toThrow("failed");

    expect(started).toEqual([1, 2]);
  });
});
