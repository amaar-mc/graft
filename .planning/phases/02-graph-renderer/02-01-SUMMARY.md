---
phase: 02-graph-renderer
plan: 01
subsystem: graph
tags: [file-graph, dependency-graph, traversal, tree-sitter, typescript, python]

# Dependency graph
requires:
  - phase: 01-foundation-parser
    provides: ParseResult, CodeNode types from src/parser/types.ts
provides:
  - FileGraph interface with bidirectional edges and definitions map
  - buildGraph function converting ParseResult[] to FileGraph
  - forwardDeps/reverseDeps traversal queries
  - TreeRendererOptions, JsonRendererOptions, TraversalResult type contracts
affects: [02-graph-renderer/02-02, 02-graph-renderer/02-03, 03-mcp-cli]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-pass graph construction: index files first, resolve edges second"
    - "Extension-waterfall resolution: bare path -> extensions -> index variants"
    - "Python relative import dot-counting: N dots = navigate N-1 levels up from importer"
    - "Set deduplication at edge level: Map<string, Set<string>> ensures no duplicate edges"
    - "ReadonlySet/ReadonlyMap cast at return: mutable internally, immutable at boundary"

key-files:
  created:
    - src/graph/types.ts
    - src/graph/index.ts
    - src/graph/traversal.ts
    - tests/graph/build.test.ts
    - tests/graph/queries.test.ts
  modified:
    - src/graph/types.ts

key-decisions:
  - "FileGraph uses ReadonlySet/ReadonlyMap for immutable public surface — mutable Map<string, Set<string>> internally, cast at return boundary"
  - "resolveImportPath silently drops non-relative refs (npm packages, builtins) — no error, no edge"
  - "Python single-dot detected via /^\.([\w].*)$/ regex, not by startsWith('.') to avoid double-counting ../  paths"
  - "forwardDeps/reverseDeps are thin wrappers — exist for named public API contract consumed by Phase 3 CLI/MCP"

patterns-established:
  - "TDD RED/GREEN per task: failing test commit followed by implementation commit"
  - "Synthetic ParseResult fixtures in tests — no real file parsing, full isolation"
  - "Platform-agnostic test paths: /project/src/ prefix avoids OS path differences"

requirements-completed: [GRAPH-01, GRAPH-04, GRAPH-05]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 2 Plan 01: Graph Types and Dependency Graph Builder Summary

**Directed FileGraph with bidirectional import edges built from ParseResult[], supporting relative path resolution for TypeScript/JavaScript/Python including index file and extension waterfall resolution.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T08:24:47Z
- **Completed:** 2026-03-28T08:28:49Z
- **Tasks:** 2
- **Files modified:** 5 (3 created in src/graph/, 2 test files)

## Accomplishments

- FileGraph interface and all Phase 2 type contracts defined (TraversalResult, TreeRendererOptions, JsonRendererOptions, PageRankOptions, PageRankResult)
- buildGraph converts ParseResult[] to FileGraph with correct bidirectional edges, handling relative paths, extension waterfall, index file resolution, and Python dot-relative imports
- forwardDeps and reverseDeps provide the public API contract for Phase 3 CLI/MCP consumers, returning empty sets for unknown files without throwing

## Task Commits

Each task was committed atomically (TDD: test commit then feat commit):

1. **Task 1 RED: Graph construction tests** - `d85803b` (test)
2. **Task 1 GREEN: buildGraph + type contracts** - `b1b5cd8` (feat)
3. **Task 2 RED: Traversal query tests** - `9e0ba76` (test)
4. **Task 2 GREEN: forwardDeps + reverseDeps** - `9d4656e` (feat)

**Plan metadata:** (final commit — docs)

_Note: types.ts extended in b1b5cd8; TraversalResult, TreeRendererOptions, JsonRendererOptions added for Phase 2 full type contract coverage._

## Files Created/Modified

- `src/graph/types.ts` - FileGraph, PageRankOptions, PageRankResult, TraversalResult, TreeRendererOptions, JsonRendererOptions — all Phase 2 type contracts
- `src/graph/index.ts` - buildGraph function: two-pass construction (index then resolve), resolveImportPath with extension waterfall and Python dot-counting
- `src/graph/traversal.ts` - forwardDeps and reverseDeps: thin wrappers over FileGraph edges for public API
- `tests/graph/build.test.ts` - 13 tests covering empty input, edge construction, import resolution, Python relative imports, barrel exports, deduplication, definitions
- `tests/graph/queries.test.ts` - 8 tests covering forwardDeps and reverseDeps on A->B->C, D->B fixture

## Decisions Made

- FileGraph uses `ReadonlySet`/`ReadonlyMap` for immutable public surface — mutable `Map<string, Set<string>>` internally, cast at return boundary. Avoids defensive copying.
- `resolveImportPath` silently drops non-relative refs (npm packages, node builtins) — returning null with no error or edge. Matches the plan's "silently dropped" spec.
- Python single-dot imports detected via `/^\.([\w].*)$/` regex to distinguish `.models` from `./relative` — avoids misclassifying standard `./` paths.
- `forwardDeps`/`reverseDeps` are intentionally thin wrappers — they exist to establish the named public API contract that Phase 3 CLI/MCP will consume directly.

## Deviations from Plan

None - plan executed exactly as written. The `types.ts` extended-types additions (TraversalResult, TreeRendererOptions, JsonRendererOptions) were specified in the plan's action section and committed as part of the implementation.

## Issues Encountered

None. All 21 tests (13 build + 8 queries) passed on first GREEN run. TypeScript strict mode passed with zero errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FileGraph, buildGraph, forwardDeps, reverseDeps are fully tested and ready for 02-02 (PageRank engine already implemented in parallel) and 02-03 (renderer)
- All Phase 2 type contracts established in src/graph/types.ts — PageRank and renderer plans can import directly
- No blockers

---
*Phase: 02-graph-renderer*
*Completed: 2026-03-28*

## Self-Check: PASSED

- FOUND: src/graph/types.ts
- FOUND: src/graph/index.ts
- FOUND: src/graph/traversal.ts
- FOUND: tests/graph/build.test.ts
- FOUND: tests/graph/queries.test.ts
- FOUND commit: d85803b (test RED build)
- FOUND commit: b1b5cd8 (feat GREEN buildGraph)
- FOUND commit: 9e0ba76 (test RED queries)
- FOUND commit: 9d4656e (feat GREEN traversal)
