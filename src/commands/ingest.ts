import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { type Backend, CodexBackend } from "../backend.js";
import { OperationalError } from "../errors.js";
import { extractClaims } from "../extract.js";
import { findGitRoot, getCurrentCommit } from "../git.js";
import { type Config, ConfigSchema, type MappingEntry } from "../schemas.js";
import { findCandidates } from "../search.js";
import { readDriftwatchJson, writeDriftwatchJson } from "../storage.js";
import { verifyClaim } from "../verify.js";

export interface IngestSummary {
  claimCount: number;
  commit: string;
}

interface IngestDependencies {
  createBackend?: (config: Config, root: string) => Backend;
}

function recordPrdPath(root: string, absolutePath: string): string {
  const relativePath = relative(root, absolutePath);
  if (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  ) {
    return relativePath.split(sep).join("/");
  }
  return absolutePath;
}

async function readPrd(
  path: string,
): Promise<{ content: string; path: string }> {
  try {
    const canonicalPath = await realpath(path);
    return {
      content: await readFile(canonicalPath, "utf8"),
      path: canonicalPath,
    };
  } catch (error) {
    throw new OperationalError(`could not read PRD at ${path}`, {
      cause: error,
    });
  }
}

export async function ingestCommand(
  cwd: string,
  prdPath: string,
  dependencies: IngestDependencies = {},
): Promise<IngestSummary> {
  const root = await findGitRoot(cwd);
  const config = await readDriftwatchJson(root, "config.json", ConfigSchema);
  const requestedPrdPath = resolve(cwd, prdPath);
  const prd = await readPrd(requestedPrdPath);
  const initialCommit = await getCurrentCommit(root);
  const backend =
    dependencies.createBackend?.(config, root) ??
    new CodexBackend(config.model, root);
  const claims = await extractClaims(prd.content, backend);
  const mapping: Record<string, MappingEntry> = {};

  for (const claim of claims) {
    const candidates = await findCandidates(root, claim);
    const verification = await verifyClaim(root, claim, candidates, backend);
    mapping[claim.id] = {
      ...verification,
      checkedAtCommit: initialCommit,
    };
  }

  const finalCommit = await getCurrentCommit(root);
  if (finalCommit !== initialCommit) {
    throw new OperationalError("HEAD changed during ingest; rerun the command");
  }

  const nextConfig: Config = {
    ...config,
    prdPath: recordPrdPath(root, prd.path),
  };
  await writeDriftwatchJson(root, "claims.json", claims);
  await writeDriftwatchJson(root, "mapping.json", mapping);
  await writeDriftwatchJson(root, "config.json", nextConfig);

  return { claimCount: claims.length, commit: initialCommit };
}
