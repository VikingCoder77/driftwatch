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

1. Add the required `demo/` service, demo PRD, and at least three genuine seeded violations.
2. Run `ingest` and `report` against the demo, tune prompts, and ensure zero false `VIOLATED` results.
3. Improve README packaging instructions and add the required judge-focused demo assets.

## Live Codex Validation

- YOLO-mode nested `codex exec` is functional with the Codex binary bundled in ChatGPT: `/Applications/ChatGPT.app/Contents/Resources/codex` (`0.145.0-alpha.18`).
- The Homebrew link `/opt/homebrew/bin/codex` is broken because its `0.130.0` target directory contains no executable.
- The generic model slug `gpt-5.6` returns HTTP 400 for ChatGPT-authenticated Codex.
- The refreshed local catalog lists `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna`; a direct `gpt-5.6-sol` probe completed successfully.
- A real Driftwatch smoke test completed in `/tmp/driftwatch-live.pRxcW1` after setting the fixture config model to `gpt-5.6-sol` and placing the ChatGPT resource directory on `PATH`.
- Live extraction produced one valid claim, verification mapped it to `service.ts:1-3` as `SATISFIED`, `.driftwatch/DRIFT.md` was written, and `report` exited with code 0.

## Resume Instructions

Read `AGENTS.md`, `driftwatch-prd.md`, and this file before editing. Keep changes focused, validate before each commit, and continue creating small imperative commits as work progresses. Do not commit secrets, Codex credentials, `node_modules/`, `dist/`, or coverage output.
