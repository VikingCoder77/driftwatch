import { spawn } from "node:child_process";
import { OperationalError } from "./errors.js";
import type { Claim } from "./schemas.js";

const STOPWORDS = new Set([
  "a",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "contains",
  "does",
  "each",
  "for",
  "from",
  "has",
  "have",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "must",
  "no",
  "not",
  "of",
  "on",
  "only",
  "or",
  "should",
  "than",
  "that",
  "the",
  "their",
  "then",
  "this",
  "to",
  "use",
  "uses",
  "using",
  "when",
  "whose",
  "with",
]);

export interface CandidateFile {
  path: string;
  matchCount: number;
}

interface SearchProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type SearchRunner = (
  args: string[],
  cwd: string,
) => Promise<SearchProcessResult>;

export interface CandidateSearchOptions {
  paths?: string[];
  runner?: SearchRunner;
}

interface WeightedSearchTerm {
  value: string;
  weight: number;
}

export const runRipgrep: SearchRunner = (args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn("rg", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 2 });
    });
  });

function addTerm(
  terms: WeightedSearchTerm[],
  indexes: Map<string, number>,
  value: string,
  weight: number,
): void {
  const term = value.trim().replace(/^[._-]+|[._-]+$/g, "");
  const key = term.toLowerCase();
  const isNumber = /^\d/.test(term);
  if ((!isNumber && term.length < 2) || STOPWORDS.has(key)) {
    return;
  }
  const existingIndex = indexes.get(key);
  if (existingIndex !== undefined) {
    const existingTerm = terms[existingIndex];
    if (existingTerm !== undefined) {
      existingTerm.weight = Math.max(existingTerm.weight, weight);
    }
    return;
  }
  indexes.set(key, terms.length);
  terms.push({ value: term, weight });
}

function tokenWeight(token: string): number {
  if (/^\d/.test(token)) {
    return 20;
  }
  if (
    token.includes("_") ||
    token.includes(".") ||
    token.includes("-") ||
    /[a-z][A-Z]/.test(token)
  ) {
    return 1_000;
  }
  if (/^[A-Z]/.test(token)) {
    return 5;
  }
  return 1;
}

function extractWeightedSearchTerms(claimText: string): WeightedSearchTerm[] {
  const terms: WeightedSearchTerm[] = [];
  const indexes = new Map<string, number>();
  const quotedPattern = /(["'`])([^"'`]+)\1/g;

  for (const match of claimText.matchAll(quotedPattern)) {
    if (match[2] !== undefined) {
      addTerm(terms, indexes, match[2], 20);
    }
  }

  const tokenPattern = /\b[A-Za-z][A-Za-z0-9_.-]*\b|\b\d+(?:\.\d+)?\b/g;
  for (const match of claimText.matchAll(tokenPattern)) {
    addTerm(terms, indexes, match[0], tokenWeight(match[0]));
  }

  return terms;
}

export function extractSearchTerms(claimText: string): string[] {
  return extractWeightedSearchTerms(claimText).map((term) => term.value);
}

function isSearchablePath(path: string): boolean {
  const normalizedPath = path.replaceAll("\\", "/");
  return !(
    normalizedPath === ".driftwatch" ||
    normalizedPath.startsWith(".driftwatch/") ||
    normalizedPath === ".git" ||
    normalizedPath.startsWith(".git/") ||
    normalizedPath === "node_modules" ||
    normalizedPath.startsWith("node_modules/") ||
    normalizedPath.includes("/node_modules/")
  );
}

function parseMatchCounts(
  output: string,
  termWeights: Map<string, number>,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const line of output.split("\n")) {
    if (line.length === 0) {
      continue;
    }

    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    if (
      typeof event !== "object" ||
      event === null ||
      !("type" in event) ||
      event.type !== "match" ||
      !("data" in event) ||
      typeof event.data !== "object" ||
      event.data === null
    ) {
      continue;
    }

    const data = event.data as {
      path?: { text?: string };
      submatches?: Array<{ match?: { text?: string } }>;
    };
    const path = data.path?.text?.replace(/^\.\//, "");
    if (path === undefined) {
      continue;
    }
    const matchCount =
      data.submatches?.reduce((total, submatch) => {
        const matchedText = submatch.match?.text?.toLowerCase();
        return total + (matchedText ? (termWeights.get(matchedText) ?? 1) : 1);
      }, 0) ?? 1;
    counts.set(path, (counts.get(path) ?? 0) + matchCount);
  }

  return counts;
}

export async function findCandidates(
  root: string,
  claim: Claim,
  options: CandidateSearchOptions = {},
): Promise<CandidateFile[]> {
  const weightedTerms = extractWeightedSearchTerms(claim.text);
  const terms = weightedTerms.map((term) => term.value);
  const paths = options.paths?.filter(isSearchablePath);
  if (terms.length === 0 || paths?.length === 0) {
    return [];
  }

  const args = [
    "--json",
    "--ignore-case",
    "--fixed-strings",
    "--no-messages",
    "--hidden",
    "--glob",
    "!.driftwatch/**",
    "--glob",
    "!.git/**",
    "--glob",
    "!node_modules/**",
  ];
  for (const term of terms) {
    args.push("-e", term);
  }
  args.push("--", ...(paths ?? ["."]));

  let result: SearchProcessResult;
  try {
    result = await (options.runner ?? runRipgrep)(args, root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new OperationalError(
        "ripgrep not found; install `rg` and ensure it is on PATH",
        { cause: error },
      );
    }
    throw new OperationalError("candidate search could not start", {
      cause: error,
    });
  }

  if (result.exitCode === 1) {
    return [];
  }
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim().split("\n")[0];
    throw new OperationalError(
      detail ? `candidate search failed: ${detail}` : "candidate search failed",
    );
  }

  const termWeights = new Map(
    weightedTerms.map((term) => [term.value.toLowerCase(), term.weight]),
  );
  return [...parseMatchCounts(result.stdout, termWeights).entries()]
    .map(([path, matchCount]) => ({ path, matchCount }))
    .sort(
      (left, right) =>
        right.matchCount - left.matchCount ||
        left.path.localeCompare(right.path),
    )
    .slice(0, 3);
}
