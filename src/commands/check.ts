import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { type Backend, createBackend } from "../backend.js";
import { OperationalError } from "../errors.js";
import { findGitRoot, getChangedFiles, getCurrentCommit } from "../git.js";
import {
  type Claim,
  ClaimsSchema,
  type Config,
  ConfigSchema,
  type MappingEntry,
  MappingSchema,
  StateSchema,
} from "../schemas.js";
import { findCandidates } from "../search.js";
import { readDriftwatchJson, writeDriftwatchJson } from "../storage.js";
import { verifyClaim } from "../verify.js";

export interface CheckSummary {
  checkedClaimCount: number;
  commit: string;
  hasViolations: boolean;
}

interface CheckDependencies {
  createBackend?: (config: Config, root: string) => Backend;
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

export async function checkCommand(
  cwd: string,
  dependencies: CheckDependencies = {},
): Promise<CheckSummary> {
  const root = await findGitRoot(cwd);
  const [config, claims, storedMapping, state] = await Promise.all([
    readDriftwatchJson(root, "config.json", ConfigSchema),
    readDriftwatchJson(root, "claims.json", ClaimsSchema),
    readDriftwatchJson(root, "mapping.json", MappingSchema),
    readDriftwatchJson(root, "state.json", StateSchema),
  ]);
  const currentCommit = await getCurrentCommit(root);
  const changedFileList = state.lastCheckedCommit
    ? await getChangedFiles(root, state.lastCheckedCommit, currentCommit)
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
    dependencies.createBackend?.(config, root) ?? createBackend(config, root);

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

  await writeDriftwatchJson(root, "mapping.json", mapping);
  await writeDriftwatchJson(root, "state.json", {
    ...state,
    lastCheckedCommit: currentCommit,
  });

  return {
    checkedClaimCount: selectedClaims.length,
    commit: currentCommit,
    hasViolations: Object.values(mapping).some(
      (entry) => entry.status === "VIOLATED",
    ),
  };
}
