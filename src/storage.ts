import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";
import { OperationalError } from "./errors.js";
import { formatJson, parseStoredJson } from "./json.js";

const DRIFTWATCH_DIRECTORY = ".driftwatch";

export type DriftwatchFileName =
  | "claims.json"
  | "config.json"
  | "mapping.json"
  | "state.json";

export type DriftwatchTextFileName = "DRIFT.md";

function driftwatchPath(
  root: string,
  fileName: DriftwatchFileName | DriftwatchTextFileName,
): string {
  return join(root, DRIFTWATCH_DIRECTORY, fileName);
}

export async function readDriftwatchJson<T>(
  root: string,
  fileName: DriftwatchFileName,
  schema: z.ZodType<T>,
): Promise<T> {
  let input: string;
  try {
    input = await readFile(driftwatchPath(root, fileName), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new OperationalError(
        `${fileName} is missing; run \`driftwatch init\` first`,
        { cause: error },
      );
    }
    throw new OperationalError(`could not read ${fileName}`, { cause: error });
  }
  return parseStoredJson(input, schema, fileName);
}

export async function readOptionalDriftwatchJson<T>(
  root: string,
  fileName: DriftwatchFileName,
  schema: z.ZodType<T>,
  fallback: T,
): Promise<T> {
  let input: string;
  try {
    input = await readFile(driftwatchPath(root, fileName), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw new OperationalError(`could not read ${fileName}`, { cause: error });
  }
  return parseStoredJson(input, schema, fileName);
}

export async function writeDriftwatchJson(
  root: string,
  fileName: DriftwatchFileName,
  value: unknown,
): Promise<void> {
  await writeDriftwatchText(root, fileName, formatJson(value));
}

export async function writeDriftwatchText(
  root: string,
  fileName: DriftwatchFileName | DriftwatchTextFileName,
  content: string,
): Promise<void> {
  const destination = driftwatchPath(root, fileName);
  const temporaryPath = `${destination}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, content, { flag: "wx" });
    await rename(temporaryPath, destination);
  } catch (error) {
    throw new OperationalError(`could not write ${fileName}`, { cause: error });
  } finally {
    await rm(temporaryPath, { force: true });
  }
}
