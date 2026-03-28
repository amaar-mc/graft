# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-28
**Phases:** 4 | **Plans:** 17 | **Requirements:** 45/45

### What Was Built
- Complete codebase context engine: tree-sitter parsing (TS/JS + Python) → dependency graph → personalized PageRank → token-budgeted rendering
- MCP server with 5 tools and 2 resources — works with Claude Code, Cursor, and any MCP client
- CLI with 5 subcommands, colored tree output, and progress spinners
- Comprehensive test suite: unit, integration (3 fixture projects), snapshot, and E2E MCP tests

### What Worked
- Strict pipeline dependency chain (parse → graph → render → CLI/MCP → quality) kept each phase focused and testable in isolation
- CJS output decision (tsup) avoided ESM-only dependency hell with chalk v5/ora v6 — resolved early, no surprises later
- Two-phase extraction pattern (tags.scm + AST walk) handled tree-sitter grammar gaps gracefully
- `createGraftServer` extraction in Phase 4 made E2E testing straightforward via InMemoryTransport
- stderr-only logger established in Phase 1 prevented stdout contamination issues across all subsequent phases

### What Was Inefficient
- No milestone audit was run before completion — all requirements passed but formal cross-phase integration verification was skipped
- WASM fallback approach was specced but native tree-sitter worked everywhere — WASM code path may be undertested
- Phase 3 PP03 timing data appears corrupted (526025min) — metrics tracking had an edge case

### Patterns Established
- Native-first, WASM-fallback for tree-sitter grammars
- ReadonlySet/ReadonlyMap at public API boundaries, mutable internals
- Handler extraction pattern for MCP tool testability
- `buildIndex()` as single shared pipeline entry point for CLI and MCP
- Extension-waterfall resolution for import paths (bare → .ts/.js → /index.ts)
- Budget enforcement that breaks at first overflow — no partial blocks

### Key Lessons
1. Pin CJS-compatible versions of ESM-migrating deps early (chalk@4, ora@5) — ESM-only breaks npx distribution
2. Zod v3/v4 incompatibility with MCP SDK has no build-time signal — must be caught by runtime testing
3. tree-sitter tags.scm coverage varies by grammar — always pair with AST walk fallback
4. stderr-only logging is a hard requirement for MCP servers — enforce at linter level, not just convention

### Cost Observations
- Model mix: primarily Opus for planning/architecture, Sonnet for implementation
- Timeline: 2 days from initialization to shipped MVP
- Notable: 84 commits, 8,141 LOC TypeScript — high velocity enabled by strict phase sequencing

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 4 | 17 | Initial pipeline — strict sequential phases |

### Cumulative Quality

| Milestone | Requirements | Coverage Target | LOC |
|-----------|-------------|-----------------|-----|
| v1.0 | 45/45 | >90% core | 8,141 |

### Top Lessons (Verified Across Milestones)

1. Pin ESM-migrating dependencies to CJS-compatible versions for npx distribution
2. stderr-only logging is non-negotiable for MCP servers — enforce at lint level
