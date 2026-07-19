# Session Memory

**Updated:** 2026-07-19
**Repository:** `/Users/tp/NPT AI Solutions/driftwatch`  
**Branch:** `main`

## Objective

Prepare the Driftwatch v1.2 release candidate described by `driftwatch-prd.md`, including multi-harness inference, auditable waivers, stable PRD re-ingest, independent verification, and read-only CI output.

## Completed Work

- TypeScript/npm CLI with Node.js 20+ support, Commander, Zod, Vitest, and Biome.
- Four real commands: `init`, `ingest <prd>`, `check`, and `report`.
- Strict config, claim, mapping, verification, and state schemas.
- Codex backend using `codex exec --ephemeral --model <model> --sandbox read-only --color never -`.
- JSON extraction from raw or fenced model output and one corrective extraction retry.
- Search-term extraction, ripgrep candidate ranking, three-file limit, and required exclusions.
- Large-file selection using matching lines plus 40 lines of context.
- Full ingest, Git-diff incremental checks, `NOT_FOUND` retry behavior, and HEAD-change protection.
- Markdown report generation written identically to stdout and `.driftwatch/DRIFT.md`.
- Atomic state-file writes inside `.driftwatch/`.
- Committed waiver rationales with waiver-aware reports and exit codes.
- PRD re-ingest diff counts with stable claim identity and stale-waiver pruning.
- Independent builder/verifier harness and model selection.
- Versioned, read-only `check --ci` JSON with explicit Git baselines.

## Commits

- `fd25dd6` — Build Driftwatch CLI foundation
- `bd94853` — Add claim candidate verification
- `c1a42c4` — Implement end-to-end claim ingest
- `ef9035d` — Add incremental drift checks
- `81c5f23` — Render stored drift reports
- `db0408d` — Extend state for release features
- `df1ea9a` — Add committed claim waivers
- `0e83b8f` — Preserve claim identity on re-ingest
- `3f9218f` — Add independent verifier backends
- `d387722` — Add read-only CI check mode
- `a9b405f` — Export CI check options
- `d754fa0` — Document release workflow features

The working tree was clean after release-feature validation.

## Validation

- `npm --script-shell=/bin/sh run lint`
- `npm --script-shell=/bin/sh test` — 68 tests across 15 files
- `npm --script-shell=/bin/sh run build`
- CLI help smoke checks for all commands
- `git diff --check`
- `npm --cache /tmp/driftwatch-npm-cache --script-shell=/bin/sh pack --dry-run`

The explicit script shell is needed because the managed environment's reduced `PATH` does not expose `sh`. The temporary npm cache avoids unrelated root-owned entries in the user's global npm cache.

## Immediate Next Steps

1. Review npm publication metadata and publish the package when credentials and final versioning are ready.
2. Run Driftwatch against its own full PRD and compare extracted claims with the numbered requirements.
3. Prepare final challenge video and submission materials without adding new product scope.

## Release Workflow Features

- Waivers are managed through `report --waive <id> --reason <text>` and `report --unwaive <id>`, remain visible in a dedicated report section, and suppress exit code 1 only for the waived claim.
- Extraction records explicit PRD requirement identifiers as `sourceId`; re-ingest preserves ids by `sourceId`, falls back to normalized claim content, and reports added/changed/removed/unchanged counts.
- `init` accepts `--verifier-backend` and `--verifier-model`; extraction uses the builder while ingest verification and checks use the verifier.
- `check --ci [--base <git-ref>]` returns schema-versioned JSON without writing mapping or state. An executable smoke test confirmed unchanged file hashes, one waived result, and correct exit behavior.
- The PRD is version 1.2 with 50 sequential acceptance requirements, including `R45` through `R50` for these release features.

## Live Codex Validation

- YOLO-mode nested `codex exec` is functional with the Codex binary bundled in ChatGPT: `/Applications/ChatGPT.app/Contents/Resources/codex` (`0.145.0-alpha.18`).
- The Homebrew link `/opt/homebrew/bin/codex` is broken because its `0.130.0` target directory contains no executable.
- The generic model slug `gpt-5.6` returns HTTP 400 for ChatGPT-authenticated Codex.
- The refreshed local catalog lists `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`; a direct `gpt-5.6-sol` probe completed successfully.
- A real Driftwatch smoke test completed in `/tmp/driftwatch-live.pRxcW1` after setting the fixture config model to `gpt-5.6-sol` and placing the ChatGPT resource directory on `PATH`.
- Live extraction produced one valid claim, verification mapped it to `service.ts:1-3` as `SATISFIED`, `.driftwatch/DRIFT.md` was written, and `report` exited with code 0.

## Live Demo Validation

- The committed demo source defines three satisfied controls and three intentional contradictions.
- Candidate-ranking tuning ensures `demo/src/service.ts` appears within the three-file limit for every extracted demo claim.
- Live `ingest demo/PRD.md` with `gpt-5.6-sol` extracted the intended six claims.
- The final report contains exactly 3 `VIOLATED`, 0 `NOT_FOUND`, and 3 `SATISFIED` results.
- Every violated result cites the direct contradictory constant in `demo/src/service.ts`; no false violations were observed.
- `report` exits with code 1 as required and writes identical content to `.driftwatch/DRIFT.md`.
- A live first-run `check` reverified all 6 claims at commit `26a063b` and exited with code 1 because the three intentional violations remain.
- An immediate second `check` at the same HEAD verified 0 claims, preserved the stored mapping, and still exited with code 1.
- `npm pack` produced a 21.2 kB package, a clean temporary install linked `node_modules/.bin/driftwatch` to `dist/cli.js`, and the installed CLI help smoke test passed.
- `scripts/render-demo-gif.sh` reproducibly generates the 1200×720, 7-second animated terminal report at `assets/driftwatch-demo.gif`; representative and final frames passed visual inspection.

## Full Self-Audit

- A clean-clone baseline ingest of `driftwatch-prd.md` at `34f0ee9` extracted 103 non-duplicate claims in 930.78 seconds; the serial verifier missed M2's 10-minute limit.
- Commit `123fc7b` added bounded four-worker verification while preserving claim-order output and stopping new scheduling after a failure.
- A second clean-clone ingest at `123fc7b` extracted 65 claims in 274.82 seconds. Its extraction represented every numbered requirement from R1 through R44 and exceeded M2's 35-claim floor.
- Self-audit exposed a false violation cited only from `README.md`, despite the prompt disallowing documentation as implementation evidence. Commit `96b97a2` deterministically downgrades documentation-only `SATISFIED` and `VIOLATED` results to `NOT_FOUND`.
- Commit `aa81105` aligned G2 with R6 so the incremental-check goal explicitly includes retrying unmapped claims against changed files.
- The no-build judge install goal remains release-dependent until the package is published; it should be `NOT_FOUND`, not `VIOLATED`, before publication.
- A live incremental benchmark used exactly 10 changed files and six affected mapped claims. `check` completed in 36.33 seconds, exited 0, and the wrapper counted exactly six real Codex subprocesses, satisfying G2 and M3.
- `test/check.test.ts` now preserves the 10-file/six-call scenario as deterministic regression coverage.

## Fresh-Checkout Judge Flow

- Commander was pinned to the Node 20-compatible v14 line after a clean install revealed that Commander 15 requires Node 22.12 despite the package claiming Node 20 support.
- R42 and the README now consistently run the demo from the repository root. The documented two commands are `npm install` followed by the chained source-mode ingest and report, with no build step.
- A clean clone at `1c8d9ee` installed without engine or vulnerability warnings and completed the exact two-command demo flow in 26 seconds.
- Live extraction returned the intended six claims; the report showed exactly 3 `VIOLATED`, 0 `NOT_FOUND`, and 3 `SATISFIED`, exited 1 intentionally, and displayed the current ingest commit.
- Candidate ranking now keeps implementation-capable paths ahead of tests and documentation so repeated fixture assertions cannot crowd direct source evidence out of the three-file limit.

## Multi-Harness Expansion

- Driftwatch now supports `codex`, `opencode`, `claude-code`, and `antigravity` through one backend factory. `init --backend <name> [--model <model>]` writes the selected adapter; a null model uses the harness default.
- Codex runs in its read-only sandbox, OpenCode runs with all tool permissions denied, Claude Code runs statelessly with built-in and MCP tools disabled, and Antigravity receives an explicit no-tools/no-writes instruction.
- Official non-interactive contracts were verified as `codex exec`, `opencode run`, `claude -p`, and `agy -p`. Missing selected executables produce named, actionable exit-2 errors.
- OpenCode 1.14.50 and Antigravity 1.0.13 passed both adapter JSON round trips and full authenticated demo ingests. Each produced exactly 3 `VIOLATED`, 0 `NOT_FOUND`, and 3 `SATISFIED` results with direct source evidence.
- Codex 0.145.0-alpha.18 passed the same full demo after the shared prompt changes. Claude Code 2.1.214 was installed temporarily, and all configured flags matched its real help output, but `claude auth status` reported `loggedIn: false`, so its authenticated model call remains pending.
- Verification now retries one malformed harness response with a corrective prompt. Explicitly numbered requirements are preserved as one claim, stabilizing the six-claim demo across harnesses.

## Resume Instructions

Read `AGENTS.md`, `driftwatch-prd.md`, and this file before editing. Keep changes focused, validate before each commit, and continue creating small imperative commits as work progresses. Do not commit secrets, Codex credentials, `node_modules/`, `dist/`, or coverage output.
