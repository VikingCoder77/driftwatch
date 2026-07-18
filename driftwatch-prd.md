# Driftwatch — Product Requirements Document

**Version:** 1.1 (Hackathon v1 — OpenAI Codex Challenge, Developer Tools track)
**Status:** Approved for build
**Owner:** Thomas / NPT Solutions
**Build window:** 6 days, built entirely in Codex with GPT-5.6

> **Note to implementers (and to driftwatch itself):** This document is deliberately written as a set of testable assertions. It is the first PRD driftwatch will be run against. Every numbered requirement is intended to be extractable as a claim and verifiable against the codebase.

---

## 1. Problem Statement

AI coding agents write code faster than humans can verify it against intent. A developer hands a PRD to an agent, and across many sessions the implementation quietly diverges from the spec in small, undocumented ways: a signing step removed, a pricing tier skipped, a limit changed. Nobody notices until production or review. Existing tools verify code against *code* (tests, linters, type checkers), but nothing verifies code against the *specification*. Driftwatch closes that gap: it turns a PRD into a set of tracked claims and continuously reports which claims the codebase satisfies, violates, or has not implemented.

## 2. Goals

- G1: A developer can go from `driftwatch init` to a full drift report on a real repo in under 15 minutes.
- G2: Incremental checks after a coding session complete in under 90 seconds for a typical diff (≤15 changed files), by re-verifying claims mapped to changed files and retrying unmapped claims only against that diff.
- G3: A violated claim is reported with enough evidence (claim text, file path, line range, one-sentence rationale) that the developer's next agent prompt can simply be "fix claim N".
- G4: Judges can install and run driftwatch against the bundled demo repository without building from source.

## 3. Non-Goals (v1)

- NG1: Driftwatch does not auto-fix violations. It reports; the developer or their agent fixes.
- NG2: No direct provider API integrations or API-key handling. Inference is available only through supported, locally installed harness CLIs.
- NG3: No waiver system and no PRD re-ingest diffing. Re-running `ingest` performs a full replacement of claims. *Rationale: real-product features, not demo features.*
- NG4: No CI-specific mode, no GitHub/GitLab integration, no web UI, no multi-PRD support.
- NG5: No configuration server or telemetry. All state is local files committed to the repo.

## 4. User Stories

- US1: As a developer using a supported coding harness, I want to ingest my PRD once so that every assertion in it becomes a tracked claim.
- US2: As a developer finishing an agent coding session, I want to run one command that tells me whether the session broke any spec commitment, so I catch drift before it compounds.
- US3: As a developer reviewing a drift report, I want file-and-line evidence for each violation so I can judge it in seconds without re-reading the PRD.
- US4: As a hackathon judge, I want to clone the repo, run two commands, and see a real drift report on sample data.
- US5: As a developer, I want unimplemented claims listed separately from violations so early-stage repos are not drowned in noise.

## 5. Product Overview

Driftwatch is a command-line tool. It maintains three pieces of durable state inside the target repository and exposes four commands. All model inference is delegated to a selected, locally installed harness CLI via non-interactive execution; driftwatch itself contains no API keys and makes no direct network calls.

### 5.1 Commands

- R1: The CLI binary is named `driftwatch`.
- R2: The CLI provides exactly four commands in v1: `init`, `ingest`, `check`, and `report`.
- R3: `driftwatch init [--backend <name>] [--model <model>]` creates a `.driftwatch/` directory at the repository root containing `config.json` and an empty `state.json`. If `.driftwatch/` already exists, `init` exits with code 2 and does not overwrite anything.
- R4: `driftwatch ingest <path-to-prd.md>` extracts claims from the given Markdown file and writes them to `.driftwatch/claims.json`, fully replacing any previous contents.
- R5: `driftwatch ingest` then performs a full mapping pass: for every claim, it locates candidate files and verifies each claim against them, writing results to `.driftwatch/mapping.json`.
- R6: `driftwatch check` re-verifies only the claims whose mapped files appear in `git diff --name-only <last-checked-commit>..HEAD`, plus attempts to map any currently unmapped (`NOT_FOUND`) claims against files in that diff.
- R7: After a successful `check`, driftwatch records the current HEAD commit hash in `.driftwatch/state.json` as `lastCheckedCommit`.
- R8: If `state.json` contains no `lastCheckedCommit` (first run), `check` behaves as a full mapping pass over all claims.
- R9: `driftwatch report` prints the current status of all claims from `mapping.json` without performing any inference, and also writes the same content as Markdown to `.driftwatch/DRIFT.md`.

### 5.2 Exit Codes

- R10: `check` and `report` exit with code 0 when no claim has status `VIOLATED`.
- R11: `check` and `report` exit with code 1 when at least one claim has status `VIOLATED`.
- R12: Claims with status `NOT_FOUND` (unimplemented) never cause a non-zero exit code.
- R13: Operational failures (selected harness CLI not found, not a git repository, missing `claims.json`) exit with code 2 and print a one-line actionable error message.

### 5.3 Claim Extraction

- R14: Claim extraction sends the full PRD text to the model in a single prompt whose instructions require extracting every testable assertion and ignoring vision statements and market context.
- R15: Each extracted claim is stored with fields: `id` (string, stable within one ingest, format `C<number>`), `section` (the PRD heading it came from), `text` (the assertion, quoted or minimally normalized), and `type`.
- R16: The `type` field is one of exactly: `behavior`, `data-model`, `api-contract`, `limit`, `config`, `cli`.
- R17: The extraction prompt requires the model to respond with only a JSON array matching the claim schema, with no surrounding prose.
- R18: Driftwatch validates the model's extraction output against the claim JSON schema; on validation failure it retries exactly once with a corrective prompt, and on second failure exits with code 2.

### 5.4 Candidate Search (deterministic, no inference)

- R19: For each claim, driftwatch derives search terms by extracting distinctive tokens from the claim text (identifiers, quoted strings, numbers, capitalized nouns; common English stopwords excluded).
- R20: Candidate files are found by running ripgrep (`rg`) with those terms over the repository, excluding `.driftwatch/`, `.git/`, `node_modules/`, and paths matched by `.gitignore`.
- R21: At most 3 candidate files are passed to verification per claim. Implementation-capable paths rank ahead of tests and documentation, then a deterministic weighted match score makes exact identifiers decisively outrank quoted values, numbers, capitalized nouns, and generic tokens; ties are resolved by path.
- R22: If ripgrep finds no candidates for a claim, the claim is recorded directly as `NOT_FOUND` without any model call.

### 5.5 Verification

- R23: Verification sends one prompt per claim containing the claim text and the contents (or relevant chunks) of its candidate files.
- R24: The verification prompt requires a JSON object with fields: `status` (one of `SATISFIED`, `VIOLATED`, `NOT_FOUND`), `file` (path or null), `lines` (string range like "88-95" or null), and `evidence` (one sentence). Invalid verification output is retried exactly once with a corrective prompt; a second invalid response exits with code 2.
- R25: A file larger than 24,000 characters is chunked, and only chunks containing at least one search-term hit (plus 40 lines of surrounding context) are included in the prompt.
- R26: Verification results are written to `.driftwatch/mapping.json` keyed by claim id, each entry also storing `checkedAtCommit`.

### 5.6 Inference Harness Backends

- R27: All inference runs through a single internal `Backend` interface with one method: given a prompt string, return the model's raw text output.
- R28: V1 supports four harness adapters invoked as subprocesses in non-interactive mode: Codex (`codex exec`), OpenCode (`opencode run`), Claude Code (`claude -p`), and Antigravity (`agy -p`).
- R29: Driftwatch extracts the first syntactically valid JSON value (fenced or raw) from the backend's stdout before schema validation, discarding any surrounding text.
- R30: Every inference prompt ends with an instruction to respond with only JSON matching the given schema.
- R31: If the selected harness executable is not found on PATH, driftwatch exits with code 2 and a message naming the missing CLI and executable.
- R32: The selected harness and model are read from `config.json`; a non-null `model` is passed using that harness's model flag, while `null` uses its configured default. The shipped default is Codex with GPT‑5.6 Sol (`gpt-5.6-sol`).

### 5.7 Report Output

- R33: The terminal report groups claims into three sections in this order: Violated (❌), Unimplemented (⚠️), Satisfied (✅).
- R34: Each violated claim renders with: claim id, claim text, file:line evidence location, and the one-sentence evidence.
- R35: Satisfied claims render as single compact lines (id, truncated text, file:line).
- R36: The report header includes total counts per status and the commit hash the results reflect.
- R37: `.driftwatch/DRIFT.md` contains the identical content as GitHub-flavored Markdown with a table per section.

### 5.8 State & Config Files

- R38: `.driftwatch/config.json` contains `backend` (one of `"codex"`, `"opencode"`, `"claude-code"`, or `"antigravity"`), `model` (a non-empty string or null), and `prdPath` (recorded by the most recent `ingest`).
- R39: All three state files (`claims.json`, `mapping.json`, `state.json`) are plain JSON, human-readable, and intended to be committed to version control.
- R40: Driftwatch never modifies any file outside the `.driftwatch/` directory.

## 6. Packaging & Judge Experience

- R41: Driftwatch is runnable via `npx driftwatch` without a global install.
- R42: The repository includes a `demo/` directory containing a small sample service, its PRD, and pre-seeded drift, such that `driftwatch ingest demo/PRD.md && driftwatch report`, run from the repository root, surfaces at least 3 genuine violations.
- R43: The README leads with a two-sentence problem statement, an animated GIF of a drift report, install instructions, and a "test in 2 commands" section for judges.
- R44: The README documents where Codex and GPT-5.6 were used during development, including the primary Codex session, per challenge submission requirements.

## 7. Success Metrics

Hackathon framing — leading indicators only:

- M1: Demo-repo report is fully reproducible by a third party from README instructions alone (binary pass/fail, tested by a non-author before submission).
- M2: End-to-end `ingest` on driftwatch's own PRD (this document) completes in under 10 minutes and extracts ≥ 35 claims.
- M3: Incremental `check` on a 10-file diff spawns ≤ 6 inference-harness subprocesses.
- M4: Zero false `VIOLATED` results on the demo repo after prompt tuning (false `NOT_FOUND` is tolerated; false violations destroy trust and demo credibility).

## 8. Open Questions

- Q1 (blocking before release): Complete authenticated live smoke tests for OpenCode, Claude Code, and Antigravity on machines where those CLIs are installed.
- Q2 (non-blocking): Whether extraction quality improves by sending the PRD per-section rather than whole-document; time-boxed to a 2-hour experiment on Day 3 if extraction is noisy.
- Q3 (non-blocking): Minimum viable chunking strategy for very large files — start with R25's rule; revisit only if demo repo needs it.

## 9. Timeline

Six days, fixed by the challenge deadline. Day 1: schemas + extraction + backend. Day 2: candidate search + verification. Day 3: check/report + self-dogfood. Day 4: demo repo + prompt tuning. Day 5: packaging, README, fix-loop demo. Day 6: video and submission — no new code.

## 10. Roadmap (post-hackathon, explicitly not v1)

Waivers with committed rationale, PRD re-ingest diffing with claim identity carry-over, additional named harness adapters, optional raw APIs for CI, cross-model verification ("verifier ≠ builder"), and a CI-native mode.
