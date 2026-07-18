# Repository Guidelines

## Project Structure & Module Organization

This repository is specification-first. `driftwatch-prd.md` is the product contract; goals and requirements (`G1`, `R1`, `M1`, and similar) should remain testable and traceable to implementation. `LICENSE` contains the project license.

The Node-compatible CLI lives under `src/`, with automated tests under `test/` and compiled output in `dist/`. Keep tests aligned with source modules and place the required sample project under `demo/` when added. Runtime state belongs only in a target repository's `.driftwatch/` directory; do not write generated state elsewhere.

## Build, Test, and Development Commands

Install dependencies with `npm install`, then use the repository scripts:

- `npm run dev -- <command>` — run the TypeScript CLI from source.
- `npm run build` — compile `src/` into `dist/`.
- `npm test` — run the Vitest suite once.
- `npm run lint` — check source and configuration with Biome.
- `npm run check` — run linting, tests, and the build.

The planned user-facing smoke flow is:

- `npx driftwatch init` — initialize local Driftwatch state.
- `npx driftwatch ingest path/to/PRD.md` — extract and map claims.
- `npx driftwatch check` — verify claims affected by the current Git diff.
- `npx driftwatch report` — render stored results without inference.

Before submitting documentation-only changes, run `git diff --check` to catch whitespace errors.

## Coding Style & Naming Conventions

Use two-space indentation and run `npm run format` for Biome formatting. Prefer small TypeScript modules with explicit interfaces, especially for the PRD-required `Backend` abstraction. Use `camelCase` for variables and functions, `PascalCase` for types/classes, and kebab-case for CLI-facing filenames. Preserve exact command names, status values, JSON fields, and exit codes defined in the PRD.

## Testing Guidelines

Vitest is the test framework; no coverage threshold is configured yet. New implementation work should add focused tests for each referenced requirement, including success paths, exit codes `0`/`1`/`2`, malformed model output, Git-diff filtering, and the rule that writes stay inside `.driftwatch/`. Name tests by observable behavior, for example `init-does-not-overwrite.test.ts`. Keep the `demo/` scenario reproducible from documented commands.

## Commit & Pull Request Guidelines

History uses short, imperative subjects such as `Add incremental drift checks` and `Seed validated demo drift report`; Conventional Commit prefixes are not required. Keep commits narrowly scoped and cite relevant requirement IDs in the body when useful. Pull requests should summarize behavior, list validated commands, link issues or PRD requirements, and include terminal output or screenshots when report formatting changes.
