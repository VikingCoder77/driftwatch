import type { z } from "zod";
import { ModelOutputError, OperationalError } from "./errors.js";

function findCompositeEnd(input: string, start: number): number | undefined {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < input.length; index += 1) {
    const character = input[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{" || character === "[") {
      stack.push(character);
      continue;
    }

    if (character === "}" || character === "]") {
      const opening = stack.pop();
      const matches =
        (opening === "{" && character === "}") ||
        (opening === "[" && character === "]");
      if (!matches) {
        return undefined;
      }
      if (stack.length === 0) {
        return index + 1;
      }
    }
  }

  return undefined;
}

export function extractFirstJsonValue(input: string): unknown {
  for (let start = 0; start < input.length; start += 1) {
    const character = input[start];
    if (character !== "{" && character !== "[") {
      continue;
    }

    const end = findCompositeEnd(input, start);
    if (end === undefined) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(input.slice(start, end));
    } catch {
      parsed = undefined;
    }
    if (parsed !== undefined) {
      return parsed;
    }
  }

  throw new ModelOutputError(
    "response did not contain a valid JSON object or array",
  );
}

export function parseModelOutput<T>(input: string, schema: z.ZodType<T>): T {
  const parsed = extractFirstJsonValue(input);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
      .join("; ");
    throw new ModelOutputError(
      `response JSON failed schema validation: ${details}`,
    );
  }

  return result.data;
}

export function parseStoredJson<T>(
  input: string,
  schema: z.ZodType<T>,
  fileName: string,
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (error) {
    throw new OperationalError(`${fileName} contains invalid JSON`, {
      cause: error,
    });
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new OperationalError(
      `${fileName} does not match the expected schema`,
    );
  }

  return result.data;
}

export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
