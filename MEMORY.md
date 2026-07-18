# Session Memory

**Updated:** 2026-07-18  
**Repository:** `/Users/tp/NPT AI Solutions/driftwatch`  
**Branch:** `main`

## Objective

Build the Driftwatch v1 CLI described by `driftwatch-prd.md`: extract testable PRD claims, locate implementation candidates deterministically, verify claims through the local Codex CLI, incrementally re-check changed code, and render committed drift reports.

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

## Commits

- `fd25dd6` — Build Driftwatch CLI foundation
- `bd94853` — Add claim candidate verification
- `c1a42c4` — Implement end-to-end claim ingest
- `ef9035d` — Add incremental drift checks
- `81c5f23` — Render stored drift reports

The working tree was clean after `81c5f23`.

## Validation

- `npm --script-shell=/bin/sh run lint`
- `npm --script-shell=/bin/sh test` — 27 tests across 11 files
- `npm --script-shell=/bin/sh run build`
- CLI help smoke checks for all commands
- `git diff --check`
- `npm --cache /tmp/driftwatch-npm-cache --script-shell=/bin/sh pack --dry-run`

The explicit script shell is needed because the managed environment's reduced `PATH` does not expose `sh`. The temporary npm cache avoids unrelated root-owned entries in the user's global npm cache.

## Immediate Next Steps

1. Retest a minimal live `codex exec` invocation; nested execution previously exited with status 137, but the user reports it should now work.
2. Exercise live claim extraction with a tiny isolated fixture before running the full PRD.
3. Add the required `demo/` service, demo PRD, and at least three genuine seeded violations.
4. Run `ingest` and `report` against the demo, tune prompts, and ensure zero false `VIOLATED` results.
5. Improve README packaging instructions and add the required judge-focused demo assets.

## Resume Instructions

Read `AGENTS.md`, `driftwatch-prd.md`, and this file before editing. Keep changes focused, validate before each commit, and continue creating small imperative commits as work progresses. Do not commit secrets, Codex credentials, `node_modules/`, `dist/`, or coverage output.
