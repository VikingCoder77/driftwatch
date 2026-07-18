import type { Claim, MappingEntry, State } from "./schemas.js";

interface ReportClaim {
  claim: Claim;
  entry: MappingEntry;
}

export interface RenderedReport {
  content: string;
  hasViolations: boolean;
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function truncate(value: string, maximumLength = 88): string {
  if (value.length <= maximumLength) {
    return value;
  }
  return `${value.slice(0, maximumLength - 1)}…`;
}

function location(entry: MappingEntry): string {
  if (entry.file === null) {
    return "—";
  }
  return entry.lines === null
    ? `\`${entry.file}\``
    : `\`${entry.file}:${entry.lines}\``;
}

function table(headers: string[], rows: string[][]): string {
  const separator = headers.map(() => "---");
  const renderedRows =
    rows.length > 0
      ? rows
      : [["—", "None", ...headers.slice(2).map(() => "—")]];
  return [headers, separator, ...renderedRows]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

function resultCommit(
  state: State,
  mapping: Record<string, MappingEntry>,
): string {
  const commits = new Set(
    Object.values(mapping).map((entry) => entry.checkedAtCommit),
  );
  if (commits.size === 1) {
    return [...commits][0] ?? "unknown";
  }
  return state.lastCheckedCommit ?? "unknown";
}

export function renderDriftReport(
  claims: Claim[],
  mapping: Record<string, MappingEntry>,
  state: State,
): RenderedReport {
  const reportClaims: ReportClaim[] = claims.map((claim) => ({
    claim,
    entry: mapping[claim.id] ?? {
      status: "NOT_FOUND",
      file: null,
      lines: null,
      evidence: "No verification result is stored.",
      checkedAtCommit: "unknown",
    },
  }));
  const violated = reportClaims.filter(
    ({ entry }) => entry.status === "VIOLATED",
  );
  const unimplemented = reportClaims.filter(
    ({ entry }) => entry.status === "NOT_FOUND",
  );
  const satisfied = reportClaims.filter(
    ({ entry }) => entry.status === "SATISFIED",
  );
  const commit = resultCommit(state, mapping);

  const sections = [
    "# Driftwatch Report",
    "",
    `Commit: \`${commit}\``,
    `Totals: ❌ ${violated.length} violated · ⚠️ ${unimplemented.length} unimplemented · ✅ ${satisfied.length} satisfied`,
    "",
    "## Violated (❌)",
    "",
    table(
      ["Claim", "Requirement", "Location", "Evidence"],
      violated.map(({ claim, entry }) => [
        escapeCell(claim.id),
        escapeCell(claim.text),
        location(entry),
        escapeCell(entry.evidence),
      ]),
    ),
    "",
    "## Unimplemented (⚠️)",
    "",
    table(
      ["Claim", "Requirement", "Evidence"],
      unimplemented.map(({ claim, entry }) => [
        escapeCell(claim.id),
        escapeCell(claim.text),
        escapeCell(entry.evidence),
      ]),
    ),
    "",
    "## Satisfied (✅)",
    "",
    table(
      ["Claim", "Requirement", "Location"],
      satisfied.map(({ claim, entry }) => [
        escapeCell(claim.id),
        escapeCell(truncate(claim.text.replaceAll("`", ""))),
        location(entry),
      ]),
    ),
    "",
  ];

  return {
    content: sections.join("\n"),
    hasViolations: violated.length > 0,
  };
}
