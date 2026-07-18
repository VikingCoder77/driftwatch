import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { OperationalError } from "./errors.js";
import type { CandidateFile } from "./search.js";

const LARGE_FILE_CHARACTER_LIMIT = 24_000;
const SURROUNDING_LINE_COUNT = 40;

export interface CandidateContext {
  path: string;
  content: string;
}

interface LineRange {
  start: number;
  end: number;
}

function mergeRanges(ranges: LineRange[]): LineRange[] {
  const merged: LineRange[] = [];

  for (const range of ranges.sort((left, right) => left.start - right.start)) {
    const previous = merged.at(-1);
    if (previous !== undefined && range.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

function formatLines(lines: string[], ranges: LineRange[]): string {
  return ranges
    .map((range) =>
      lines
        .slice(range.start, range.end + 1)
        .map((line, offset) => `${range.start + offset + 1}: ${line}`)
        .join("\n"),
    )
    .join("\n...\n");
}

export function selectRelevantContent(
  content: string,
  searchTerms: string[],
): string {
  const lines = content.split("\n");
  if (content.length <= LARGE_FILE_CHARACTER_LIMIT) {
    return formatLines(lines, [{ start: 0, end: lines.length - 1 }]);
  }

  const normalizedTerms = searchTerms.map((term) => term.toLowerCase());
  const ranges: LineRange[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const normalizedLine = lines[index]?.toLowerCase() ?? "";
    if (normalizedTerms.some((term) => normalizedLine.includes(term))) {
      ranges.push({
        start: Math.max(0, index - SURROUNDING_LINE_COUNT),
        end: Math.min(lines.length - 1, index + SURROUNDING_LINE_COUNT),
      });
    }
  }

  return formatLines(lines, mergeRanges(ranges));
}

function resolveCandidatePath(root: string, candidatePath: string): string {
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(root, candidatePath);
  if (
    absolutePath !== absoluteRoot &&
    !absolutePath.startsWith(`${absoluteRoot}${sep}`)
  ) {
    throw new OperationalError(
      `candidate path escapes the repository: ${candidatePath}`,
    );
  }
  return absolutePath;
}

export async function loadCandidateContexts(
  root: string,
  candidates: CandidateFile[],
  searchTerms: string[],
): Promise<CandidateContext[]> {
  return Promise.all(
    candidates.map(async (candidate) => {
      try {
        const content = await readFile(
          resolveCandidatePath(root, candidate.path),
          "utf8",
        );
        return {
          path: candidate.path,
          content: selectRelevantContent(content, searchTerms),
        };
      } catch (error) {
        if (error instanceof OperationalError) {
          throw error;
        }
        throw new OperationalError(
          `could not read candidate file ${candidate.path}`,
          { cause: error },
        );
      }
    }),
  );
}
