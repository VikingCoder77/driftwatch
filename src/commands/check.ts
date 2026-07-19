import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { type Backend, createBackend, verifierConfig } from "../backend.js";
import { OperationalError } from "../errors.js";
import { findGitRoot, getChangedFiles, getCurrentCommit } from "../git.js";
import {
  type Claim,
  ClaimsSchema,
  type Config,
  ConfigSchema,
  type MappingEntry,
  MappingSchema,
  type State,
  StateSchema,
  type Waiver,
} from "../schemas.js";
import { findCandidates } from "../search.js";
import { readDriftwatchJson, writeDriftwatchJson } from "../storage.js";
import { verifyClaim } from "../verify.js";

export interface CheckSummary {
  checkedClaimCount: number;
  commit: string;
  hasViolations: boolean;
  ci?: CiCheckResult;
}

export interface CiClaimResult {
  claim: Claim;
  mapping: MappingEntry;
  waiver: Waiver | null;
}

export interface CiCheckResult {
  schemaVersion: 1;
  command: "check";
  baseCommit: string | null;
  commit: string;
  changedFiles: string[] | null;
  checkedClaimCount: number;
  counts: {
    violated: number;
    waived: number;
    notFound: number;
    satisfied: number;
  };
  hasViolations: boolean;
  results: CiClaimResult[];
}

export interface CheckOptions {
  createBackend?: (config: Config, root: string) => Backend;
  ci?: boolean;
  baseCommit?: string;
}

async function existingFiles(root: string, paths: string[]): Promise<string[]> {
  const results = await Promise.all(
    paths.map(async (path) => {
      try {
        return (await stat(resolve(root, path))).isFile() ? path : undefined;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return undefined;
        }
        throw new OperationalError(`could not inspect changed file ${path}`, {
          cause: error,
        });
      }
    }),
  );
  return results.filter((path): path is string => path !== undefined);
}

function claimsToCheck(
  claims: Claim[],
  mapping: Record<string, MappingEntry>,
  changedFiles: Set<string> | undefined,
): Claim[] {
  if (changedFiles === undefined) {
    return claims;
  }

  return claims.filter((claim) => {
    const entry = mapping[claim.id];
    if (entry === undefined) {
      return true;
    }
    if (entry.status === "NOT_FOUND") {
      return changedFiles.size > 0;
    }
    return entry.file !== null && changedFiles.has(entry.file);
  });
}

function ciResult(
  claims: Claim[],
  mapping: Record<string, MappingEntry>,
  state: State,
  baseCommit: string | undefined,
  commit: string,
  changedFiles: string[] | undefined,
  checkedClaimCount: number,
): CiCheckResult {
  const results = claims.map((claim) => ({
    claim,
    mapping: mapping[claim.id] ?? {
      status: "NOT_FOUND" as const,
      file: null,
      lines: null,
      evidence: "No verification result is stored.",
      checkedAtCommit: "unknown",
    },
    waiver: state.waivers[claim.id] ?? null,
  }));
  const counts = {
    violated: results.filter(
      ({ mapping: entry, waiver }) =>
        entry.status === "VIOLATED" && waiver === null,
    ).length,
    waived: results.filter(
      ({ mapping: entry, waiver }) =>
        entry.status === "VIOLATED" && waiver !== null,
    ).length,
    notFound: results.filter(
      ({ mapping: entry }) => entry.status === "NOT_FOUND",
    ).length,
    satisfied: results.filter(
      ({ mapping: entry }) => entry.status === "SATISFIED",
    ).length,
  };

  return {
    schemaVersion: 1,
    command: "check",
    baseCommit: baseCommit ?? null,
    commit,
    changedFiles: changedFiles ?? null,
    checkedClaimCount,
    counts,
    hasViolations: counts.violated > 0,
    results,
  };
}

export async function checkCommand(
  cwd: string,
  options: CheckOptions = {},
): Promise<CheckSummary> {
  if (options.baseCommit !== undefined && options.ci !== true) {
    throw new OperationalError("--base requires --ci");
  }
  const root = await findGitRoot(cwd);
  const [config, claims, storedMapping, state] = await Promise.all([
    readDriftwatchJson(root, "config.json", ConfigSchema),
    readDriftwatchJson(root, "claims.json", ClaimsSchema),
    readDriftwatchJson(root, "mapping.json", MappingSchema),
    readDriftwatchJson(root, "state.json", StateSchema),
  ]);
  const currentCommit = await getCurrentCommit(root);
  const baseCommit = options.baseCommit ?? state.lastCheckedCommit;
  const changedFileList = baseCommit
    ? await getChangedFiles(root, baseCommit, currentCommit)
    : undefined;
  const changedFileSet =
    changedFileList === undefined ? undefined : new Set(changedFileList);
  const searchableFiles =
    changedFileList === undefined
      ? undefined
      : await existingFiles(root, changedFileList);
  const selectedClaims = claimsToCheck(claims, storedMapping, changedFileSet);
  const mapping = { ...storedMapping };
  const backend =
    options.createBackend?.(verifierConfig(config), root) ??
    createBackend(verifierConfig(config), root);

  for (const claim of selectedClaims) {
    const candidates = await findCandidates(
      root,
      claim,
      searchableFiles === undefined ? {} : { paths: searchableFiles },
    );
    const verification = await verifyClaim(root, claim, candidates, backend);
    mapping[claim.id] = {
      ...verification,
      checkedAtCommit: currentCommit,
    };
  }

  if ((await getCurrentCommit(root)) !== currentCommit) {
    throw new OperationalError("HEAD changed during check; rerun the command");
  }

  if (options.ci !== true) {
    await writeDriftwatchJson(root, "mapping.json", mapping);
    await writeDriftwatchJson(root, "state.json", {
      ...state,
      lastCheckedCommit: currentCommit,
    });
  }

  const summary: CheckSummary = {
    checkedClaimCount: selectedClaims.length,
    commit: currentCommit,
    hasViolations: Object.entries(mapping).some(
      ([claimId, entry]) =>
        entry.status === "VIOLATED" && state.waivers[claimId] === undefined,
    ),
  };
  if (options.ci === true) {
    summary.ci = ciResult(
      claims,
      mapping,
      state,
      baseCommit,
      currentCommit,
      changedFileList,
      selectedClaims.length,
    );
  }
  return summary;
}
