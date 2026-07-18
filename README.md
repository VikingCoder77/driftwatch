# Driftwatch

Driftwatch detects when implementation quietly diverges from a product requirements document. It turns testable PRD assertions into tracked claims and reports violations with file-and-line evidence.

> **Status:** Active v1 build. `init` and end-to-end `ingest` are implemented; incremental `check` and report rendering are next.

## Requirements

- Node.js 20 or newer
- Git
- `rg` (ripgrep)
- An installed and authenticated Codex CLI

## Development

```sh
npm install
npm run build
npm test
```

Run the CLI from source:

```sh
npm run dev -- init
npm run dev -- ingest driftwatch-prd.md
```

`init` creates `.driftwatch/config.json` and `.driftwatch/state.json` at the Git repository root. `ingest` extracts claims, ranks up to three candidate files per claim with ripgrep, verifies them through the local Codex CLI, and writes `claims.json` plus `mapping.json`. Generated JSON is human-readable and intended to be committed.

## Commands

The v1 interface contains exactly four commands:

- `driftwatch init`
- `driftwatch ingest <path-to-prd.md>`
- `driftwatch check`
- `driftwatch report`

See `driftwatch-prd.md` for the complete product contract and numbered acceptance requirements.
