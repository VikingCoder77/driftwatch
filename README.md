# Driftwatch

**Spec-drift detection for agentic coding.** Driftwatch verifies your codebase against your PRD — not code against code, but code against intent.

AI agents write code faster than anyone can check it against the spec. Across enough sessions, implementations quietly diverge: a signing step dropped, a limit changed, a feature never built. Tests pass, linters are happy, and the spec is broken. Driftwatch turns every testable assertion in a PRD into a tracked claim and reports which claims your code satisfies, violates, or has not implemented — with file-and-line evidence.

![Driftwatch report showing three seeded violations](https://raw.githubusercontent.com/vikingcoder77/driftwatch/main/assets/driftwatch-demo.gif)

```
❌ VIOLATED      3   ⚠️ UNIMPLEMENTED  0   ✅ SATISFIED  3        commit a1b2c3d

❌ C7   Manifests are signed with ed25519 before upload
        src/sync/manifest.ts:140 — signing call removed; TODO comment left in place
```

A violated claim prints with enough context that your next prompt to the agent is literally *"fix claim C7."*

## How it works

1. **`driftwatch ingest <prd.md>`** — extracts every testable assertion, preserves claim identities across PRD revisions, reports the re-ingest diff, and fully verifies the current claim set.
2. **`driftwatch check`** — re-verifies mapped claims affected by the Git diff and retries unmapped claims. `--ci` emits read-only JSON for automation.
3. **`driftwatch report`** — renders the stored result with no inference. Violations can be waived only with a rationale committed in `state.json`.

Verification always runs in a clean agent with zero memory of the session that wrote the code. Configure a different verifier harness or model when the builder must not grade its own work.

All state (`claims.json`, `mapping.json`, `state.json`) is human-readable JSON at the Git repository root under `.driftwatch/`, intended to be committed. Driftwatch never modifies files outside that directory, contains no API keys, and makes no network calls of its own — all inference is delegated to the harness already installed on your machine.

## Try it in 2 commands

For judges and the impatient — from a fresh checkout, no build step:

```sh
npm install
npm run dev -- ingest demo/PRD.md && npm run dev -- report
```

Expected summary: `3 violated · 0 waived · 0 unimplemented · 3 satisfied`. The violations in `demo/` are intentionally seeded; `report` exits with code `1` and writes `.driftwatch/DRIFT.md`.

Quick smoke test without cloning anything:

```sh
npx driftwatch --help
```

## Requirements

- Node.js 20 or newer
- Git
- `rg` (ripgrep)
- One installed and authenticated inference harness on `PATH`

Driftwatch is Codex-first and validated end-to-end with Codex + GPT-5.6 Sol. The backend is pluggable, so other agent CLIs work through the same interface:

| Backend | Executable | Initialization example |
| --- | --- | --- |
| `codex` (default) | [`codex`](https://learn.chatgpt.com/docs/codex/cli) | `driftwatch init --backend codex --model gpt-5.6-sol` |
| `opencode` | [`opencode`](https://dev.opencode.ai/docs/cli/) | `driftwatch init --backend opencode --model anthropic/claude-sonnet-4-6` |
| `claude-code` | [`claude`](https://code.claude.com/docs/en/headless) | `driftwatch init --backend claude-code --model sonnet` |
| `antigravity` | [`agy`](https://antigravity.google/docs/cli-reference) | `driftwatch init --backend antigravity --model "Gemini 3.5 Flash (Low)"` |

Omit `--model` to use the harness's configured default. Release validation ran the full demo on Codex, OpenCode 1.14.50, and Antigravity 1.0.13 — each produced the identical `3 violated · 0 waived · 0 unimplemented · 3 satisfied` report. Claude Code 2.1.214 accepts the configured non-interactive flags; full validation is tracked for v0.2.

**macOS note:** the ChatGPT desktop app bundles Codex. If `codex --version` is not found:

```sh
export PATH="/Applications/ChatGPT.app/Contents/Resources:$PATH"
codex --version
```

## Install

```sh
npx driftwatch --help        # no install
npm install -g driftwatch    # or global
```

From source:

```sh
npm install
npm run build
node dist/cli.js --help
```

## Usage

```sh
driftwatch init [--backend <name>] [--model <model>] [--verifier-backend <name>] [--verifier-model <model>]
driftwatch ingest <path-to-prd.md>                      # reconcile claims + full verification pass
driftwatch check                                         # incremental verification and state update
driftwatch check --ci [--base <git-ref>]                # read-only, versioned JSON for CI
driftwatch report --waive C7 --reason "Accepted until migration completes"
driftwatch report --unwaive C7
```

The interface remains exactly four commands. To change an initialized repository, edit `.driftwatch/config.json`: `backend`/`model` select the builder and `verifierBackend`/`verifierModel` optionally select an independent verifier. A null model uses the harness default. Driftwatch invokes harnesses non-interactively and restricts their tools to read-only wherever the CLI exposes a mechanism for it.

`check --ci` never updates `.driftwatch/`. Its JSON includes commits, changed files, status counts, mappings, and waiver metadata; it exits `1` only for unwaived violations. Use `--base origin/main`, `--base "$BASE_SHA"`, or another Git ref supplied by your CI provider.

The complete product contract, including all 50 numbered acceptance requirements, lives in [`driftwatch-prd.md`](driftwatch-prd.md) — which is also the first PRD Driftwatch was run against.

## What Driftwatch is not

Existing tools in this space analyze *agent behavior* — recurring mistakes, session patterns, code quality over time. Driftwatch does none of that. It answers one question only: **does the code still match the spec?** No auto-fixing, no behavioral analytics, no server, no telemetry.

## Development

```sh
npm install
npm run build
npm test
```

## Built with Codex

Driftwatch was designed and implemented entirely through Codex sessions using GPT-5.6 Sol: repository scaffolding, implementation, tests, candidate-ranking diagnosis, and live end-to-end verification against the bundled demo. It was then dogfooded on its own PRD — the committed `.driftwatch/` state and report are in this repository for review.

## Roadmap

Hosted pull-request annotations, multi-PRD workspaces, direct provider APIs, and richer machine-readable report formats.

## License

MIT
