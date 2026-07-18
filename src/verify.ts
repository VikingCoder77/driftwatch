import { extname } from "node:path";
import type { Backend } from "./backend.js";
import { loadCandidateContexts } from "./context.js";
import { ModelOutputError, OperationalError } from "./errors.js";
import { parseModelOutput } from "./json.js";
import {
  type Claim,
  type VerificationResult,
  VerificationResultSchema,
} from "./schemas.js";
import { type CandidateFile, extractSearchTerms } from "./search.js";

const DOCUMENTATION_EXTENSIONS = new Set([".adoc", ".md", ".mdx", ".rst"]);

function isDocumentationPath(path: string): boolean {
  return DOCUMENTATION_EXTENSIONS.has(extname(path).toLowerCase());
}

function buildVerificationPrompt(
  claim: Claim,
  contexts: Awaited<ReturnType<typeof loadCandidateContexts>>,
): string {
  const files = contexts
    .map(
      (context) => `<file path="${context.path}">
${context.content}
</file>`,
    )
    .join("\n\n");

  return `Verify one product claim against candidate implementation files.

Claim ${claim.id}: ${claim.text}

Use only direct evidence in the provided files. Mark SATISFIED only when implementation evidence clearly fulfills the claim. Mark VIOLATED only when implementation evidence directly contradicts the claim. Otherwise mark NOT_FOUND. A PRD, documentation restatement, or test expectation alone is not implementation evidence.

Respond with only one JSON object containing exactly:
- status: SATISFIED, VIOLATED, or NOT_FOUND
- file: one provided candidate path, or null
- lines: a line range such as "88-95", or null
- evidence: one concise sentence

${files}`;
}

export async function verifyClaim(
  root: string,
  claim: Claim,
  candidates: CandidateFile[],
  backend: Backend,
): Promise<VerificationResult> {
  if (candidates.length === 0) {
    return {
      status: "NOT_FOUND",
      file: null,
      lines: null,
      evidence: "No repository files matched the claim's distinctive terms.",
    };
  }

  const contexts = await loadCandidateContexts(
    root,
    candidates,
    extractSearchTerms(claim.text),
  );
  const output = await backend.run(buildVerificationPrompt(claim, contexts));

  let result: VerificationResult;
  try {
    result = parseModelOutput(output, VerificationResultSchema);
  } catch (error) {
    if (error instanceof ModelOutputError) {
      throw new OperationalError(
        `Codex returned invalid verification JSON for ${claim.id}`,
        { cause: error },
      );
    }
    throw error;
  }

  if (
    result.file !== null &&
    !candidates.some((candidate) => candidate.path === result.file)
  ) {
    throw new OperationalError(
      `Codex cited a file outside the candidates for ${claim.id}`,
    );
  }

  if (
    result.status !== "NOT_FOUND" &&
    result.file !== null &&
    isDocumentationPath(result.file)
  ) {
    return {
      status: "NOT_FOUND",
      file: null,
      lines: null,
      evidence:
        "Only documentation matched; no direct implementation evidence was found.",
    };
  }

  return result;
}
