# Repository Guidelines

## Project Structure & Module Organization
- Source lives in `src/`; `src/index.ts` exposes the CLI entry point, while `src/cli/`, `src/config/`, `src/types/`, and `src/utils/` hold command handlers, configuration helpers, shared types, and utilities.
- Tests reside in `tests/`, mirroring feature folders (`tests/cli/`, `tests/config/`, etc.) and use `*.test.ts` naming so Vitest auto-discovers them.
- Runtime artifacts land in `dist/` after builds; keep it out of commits. Shared scripts and tooling live in `scripts/`, `docs/`, and the root config files (`tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts`, `bunfig.toml`).

## Build, Test, and Development Commands
- Install dependencies with `bun install` (other package managers are blocked by `only-allow bun`).
- `bun run build` compiles the CLI via tsdown, emitting CJS/ESM bundles and type declarations to `dist/`.
- `bun run lint`, `bun run lint:fix`, and `bun run typecheck` keep formatting and types clean; run them before pushing.
- Use `bun run test` for the full suite, `bun run test:watch` while iterating, and `bun run test:coverage` to review coverage locally.
- `bun run ci` chains lint, typecheck, tests, build, and export checks; it should succeed before opening a PR.

## Coding Style & Naming Conventions
- Biome enforces two-space indentation, LF line endings, 120-character lines, double quotes, and semicolons; rely on `bun run lint:fix` for formatting.
- Prefer TypeScript strictness: explicit return types for exported APIs and `readonly` where possible. Organize modules so shared helpers live in `src/utils/` and re-export through `src/index.ts` when needed.
- Use camelCase for variables/functions, PascalCase for classes/types, and kebab-case for file names unless a file exports a class (e.g., `ConfigManager.ts`).

## Testing Guidelines
- Vitest is the testing framework; create colocated spec files under `tests/` using descriptive names like `cli/config.test.ts`.
- `bunfig.toml` enforces 90% line and function coverage; ensure new features include unit or integration tests to maintain this bar.
- Prefer mocking external services, but validate CLI flows end-to-end via the existing command tests.

## Commit & Pull Request Guidelines
- Commitlint requires Conventional Commits (e.g., `feat(cli): add dify provider`); Husky runs `bun run precommit` to lint and typecheck staged changes.
- Each PR should summarize behavior changes, list manual test steps, and link relevant issues. Attach CLI output or screenshots if UX changes.
- When publishing user-facing changes, run `bunx changeset` to record release notes before merging.

## Environment & Tooling
- Target Node 22.x (managed via Volta) and Bun >= 1.0.0. Align local versions with the project by running `volta install` if needed.
- Configure required AI provider keys through `AIGCM_*` environment variables, `.env`, or the CLI `config` command (`node ./dist/index.cjs config set ...`).
