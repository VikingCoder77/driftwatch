# Driftwatch

Driftwatch detects when implementation quietly diverges from a product requirements document. It turns testable PRD assertions into tracked claims and reports violations with file-and-line evidence.

> **Status:** Foundation build. `init`, schemas, claim extraction, and the Codex backend are implemented; end-to-end `ingest`, `check`, and `report` are next.

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
```

This creates `.driftwatch/config.json` and `.driftwatch/state.json` at the Git repository root. The generated JSON is human-readable and is intended to be committed.

## Commands

The v1 interface contains exactly four commands:

- `driftwatch init`
- `driftwatch ingest <path-to-prd.md>`
- `driftwatch check`
- `driftwatch report`

See `driftwatch-prd.md` for the complete product contract and numbered acceptance requirements.
