import { describe, expect, it, vi } from "vitest";
import type { Claim } from "../src/schemas.js";
import {
  extractSearchTerms,
  findCandidates,
  type SearchRunner,
} from "../src/search.js";

const claim: Claim = {
  id: "C20",
  section: "Candidate Search",
  text: 'The "config.json" file stores lastCheckedCommit in at most 3 files.',
  type: "behavior",
};

function matchEvent(path: string, count: number): string {
  return JSON.stringify({
    type: "match",
    data: {
      path: { text: path },
      submatches: Array.from({ length: count }, () => ({})),
    },
  });
}

function weightedMatchEvent(path: string, matches: string[]): string {
  return JSON.stringify({
    type: "match",
    data: {
      path: { text: path },
      submatches: matches.map((text) => ({ match: { text } })),
    },
  });
}

describe("extractSearchTerms", () => {
  it("keeps quoted strings, identifiers, and numbers while removing stopwords", () => {
    expect(extractSearchTerms(claim.text)).toEqual([
      "config.json",
      "file",
      "stores",
      "lastCheckedCommit",
      "most",
      "3",
      "files",
    ]);
  });
});

describe("findCandidates", () => {
  it("ranks candidates by match count and returns at most three", async () => {
    const runner = vi.fn<SearchRunner>().mockResolvedValue({
      stdout: [
        matchEvent("./src/b.ts", 2),
        matchEvent("./src/a.ts", 2),
        matchEvent("./src/c.ts", 4),
        matchEvent("./src/d.ts", 1),
        matchEvent("./src/b.ts", 1),
      ].join("\n"),
      stderr: "",
      exitCode: 0,
    });

    await expect(findCandidates("/repo", claim, { runner })).resolves.toEqual([
      { path: "src/c.ts", matchCount: 4 },
      { path: "src/b.ts", matchCount: 3 },
      { path: "src/a.ts", matchCount: 2 },
    ]);
    const args = runner.mock.calls[0]?.[0] ?? [];
    expect(args).toContain("!.driftwatch/**");
    expect(args).toContain("!.git/**");
    expect(args).toContain("!node_modules/**");
  });

  it("returns no candidates when ripgrep finds no matches", async () => {
    const runner = vi.fn<SearchRunner>().mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 1,
    });

    await expect(findCandidates("/repo", claim, { runner })).resolves.toEqual(
      [],
    );
  });

  it("ranks exact identifiers above repeated generic words", async () => {
    const runner = vi.fn<SearchRunner>().mockResolvedValue({
      stdout: [
        weightedMatchEvent("docs/noisy.md", [
          "file",
          "file",
          "stores",
          "stores",
        ]),
        weightedMatchEvent("src/config.ts", ["lastCheckedCommit"]),
      ].join("\n"),
      stderr: "",
      exitCode: 0,
    });

    const candidates = await findCandidates("/repo", claim, { runner });

    expect(candidates[0]).toEqual({
      path: "src/config.ts",
      matchCount: 1_000,
    });
    expect(candidates[1]).toEqual({ path: "docs/noisy.md", matchCount: 4 });
  });

  it("keeps implementation files ahead of tests and documentation", async () => {
    const runner = vi.fn<SearchRunner>().mockResolvedValue({
      stdout: [
        weightedMatchEvent("test/service.test.ts", [
          "lastCheckedCommit",
          "lastCheckedCommit",
          "lastCheckedCommit",
        ]),
        weightedMatchEvent("docs/PRD.md", [
          "lastCheckedCommit",
          "lastCheckedCommit",
        ]),
        weightedMatchEvent("scripts/render.sh", ["lastCheckedCommit"]),
        weightedMatchEvent("src/service.ts", ["lastCheckedCommit"]),
      ].join("\n"),
      stderr: "",
      exitCode: 0,
    });

    await expect(findCandidates("/repo", claim, { runner })).resolves.toEqual([
      { path: "scripts/render.sh", matchCount: 1_000 },
      { path: "src/service.ts", matchCount: 1_000 },
      { path: "test/service.test.ts", matchCount: 3_000 },
    ]);
  });
});
