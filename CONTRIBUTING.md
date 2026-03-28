# Contributing to Graft

First off, thanks for considering contributing to Graft! Every contribution helps make codebase context better for AI coding tools.

## Quick Start

```bash
git clone https://github.com/amaar-mc/graft.git
cd graft
pnpm install
pnpm build
pnpm test
```

## Development Workflow

1. **Fork and clone** the repository
2. **Create a branch** from `main`: `git checkout -b feat/my-feature`
3. **Install dependencies**: `pnpm install`
4. **Make your changes** — keep diffs focused and small
5. **Run tests**: `pnpm test`
6. **Run type checking**: `pnpm typecheck`
7. **Run linting**: `pnpm lint`
8. **Commit** using [conventional commits](https://www.conventionalcommits.org/): `feat(parser): add Go support`
9. **Push** and open a pull request

## Project Structure

```
src/
  parser/        # Tree-sitter AST extraction (TS/JS, Python)
  graph/         # Dependency graph + PageRank scoring
  renderer/      # Token-budgeted tree and JSON output
  indexer/       # Discovery + cache + parse pipeline
  cache/         # File-level caching (.graft/cache.json)
  cli/           # Commander-based CLI (map, serve, stats, impact, search)
  mcp/           # MCP server (5 tools, 2 resources)
  errors.ts      # Structured error types
  logger.ts      # stderr-only logger
tests/           # Vitest test suite (unit, integration, snapshot, E2E)
```

## Adding a New Language

Graft uses tree-sitter for parsing. To add a new language:

1. Add the tree-sitter grammar package to `dependencies`
2. Create `src/parser/languages/<lang>.ts` implementing the `LanguageHandler` interface
3. Register the handler in `src/parser/index.ts`
4. Add the WASM copy step in `tsup.config.ts`
5. Add integration tests with fixture files in `tests/fixtures/`
6. Update the README languages table

## Code Standards

- **TypeScript strict mode** — no `any`, no unchecked `as` casts
- **Explicit return types** on all exported functions
- **Pure functions** where possible — no side effects
- **All logging to stderr** — stdout is reserved for output and MCP protocol
- **Tests for all business logic** — aim for >90% coverage on core modules

## Commit Messages

We use [conventional commits](https://www.conventionalcommits.org/):

- `feat(scope): add new feature`
- `fix(scope): fix a bug`
- `refactor(scope): restructure without changing behavior`
- `test(scope): add or update tests`
- `docs(scope): documentation changes`
- `chore(scope): maintenance tasks`

## Reporting Bugs

Use the [bug report template](https://github.com/amaar-mc/graft/issues/new?template=bug_report.md). Include:

- Graft version (`graft --version`)
- Node.js version (`node --version`)
- OS and architecture
- Steps to reproduce
- Expected vs actual behavior

## Suggesting Features

Use the [feature request template](https://github.com/amaar-mc/graft/issues/new?template=feature_request.md). We especially welcome:

- New language support (Go, Rust, Java, etc.)
- MCP tool improvements
- Performance optimizations
- Integration guides for AI tools

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
