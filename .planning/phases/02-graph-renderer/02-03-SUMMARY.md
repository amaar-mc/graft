---
phase: 02-graph-renderer
plan: 03
subsystem: graph
tags: [pagerank, bfs, traversal, renderer, token-budget, tree, json]

requires:
  - phase: 02-graph-renderer/02-01
    provides: FileGraph type, forwardDeps/reverseDeps traversal API, buildGraph
  - phase: 02-graph-renderer/02-02
    provides: computePageRank producing scored ReadonlyMap<string, number>

provides:
  - transitiveClosure BFS over reverseEdges for impact analysis (graft impact command)
  - renderTree: score-sorted, token-budgeted text tree — primary CLI/MCP output format
  - renderJson: structured JSON output with files, definitions, scores, and metadata

affects:
  - 03-cli-mcp (consumes renderTree, renderJson, transitiveClosure directly)
  - all future phases that produce rendered context windows

tech-stack:
  added: []
  patterns:
    - "TDD RED→GREEN for all new modules: tests written first, implementation follows"
    - "charBudget = tokenBudget * charsPerToken — integer char arithmetic, no float token math"
    - "EXCLUDED_KINDS ReadonlySet for import/export filtering — single source of truth per renderer"
    - "Break-not-skip budget enforcement: partial file blocks never emitted"

key-files:
  created:
    - src/graph/traversal.ts (transitiveClosure added)
    - src/renderer/tree.ts
    - src/renderer/json.ts
    - tests/graph/impact.test.ts
    - tests/renderer/tree.test.ts
    - tests/renderer/budget.test.ts
    - tests/renderer/json.test.ts
  modified:
    - src/graph/traversal.ts

key-decisions:
  - "transitiveClosure always includes seed file itself (even if unknown to graph) — caller never needs special-case unknown handling"
  - "Budget enforcement breaks at first overflow block — partial blocks never emitted, output is always coherent"
  - "Empty graph renderTree returns only footer [~0 tokens] — no special nil path"
  - "tokenCount in JSON computed after serialization of placeholder output — approximation is intentional (recursive dependency avoided)"

patterns-established:
  - "makeGraph([edges], defs) test helper pattern established for all renderer/graph tests"
  - "EXCLUDED_KINDS const as ReadonlySet<NodeKind> — consistent import/export exclusion across renderers"

requirements-completed: [GRAPH-06, REND-01, REND-02, REND-03, REND-04, REND-05]

duration: 4min
completed: 2026-03-28
---

# Phase 2 Plan 3: Transitive Closure and Renderers Summary

**BFS transitive closure for impact analysis, token-budgeted score-sorted tree renderer, and structured JSON renderer — the "100K LOC in ~2K tokens" output layer**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T08:31:22Z
- **Completed:** 2026-03-28T08:35:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- `transitiveClosure` BFS over `reverseEdges` handles cycles, diamonds, linear chains, and unknown files — powers the `graft impact` command
- `renderTree` produces a score-descending, token-budgeted text tree with definitions and `[~N tokens]` footer — primary output for CLI and MCP context windows
- `renderJson` produces valid structured JSON with relative paths, scores, definitions, metadata (fileCount, edgeCount, tokenCount, rootDir) — for programmatic consumers
- 28 tests green across 4 test files; TypeScript strict mode passes

## Task Commits

1. **Task 1: Transitive reverse-dependency closure** - `00b8731` (feat)
2. **Task 2: Token-budgeted tree renderer and JSON renderer** - `0925e3e` (feat)

## Files Created/Modified

- `src/graph/traversal.ts` - Added `transitiveClosure` export (BFS over reverseEdges)
- `src/renderer/tree.ts` - `renderTree`: score-sorted, charBudget-enforced text tree
- `src/renderer/json.ts` - `renderJson`: structured JSON with metadata and relative paths
- `tests/graph/impact.test.ts` - 7 tests: leaf, chain, diamond, cycle, unknown, isolated
- `tests/renderer/tree.test.ts` - 8 tests: ordering, paths, scores, defs, exclusions, footer
- `tests/renderer/budget.test.ts` - 4 tests: budget boundary, small/large budgets, exclusion
- `tests/renderer/json.test.ts` - 9 tests: validity, structure, sorting, exclusions, metadata

## Decisions Made

- `transitiveClosure` always includes the seed file itself even when unknown to the graph — callers never need special-case handling for unknown files.
- Budget enforcement uses a `break` not a `continue` — once a block would overflow, no further files are considered. This prevents partial-file output and keeps the output coherent.
- Empty graph `renderTree` returns only `[~0 tokens]` without any body — no special nil path for callers.
- JSON `tokenCount` is computed from a preliminary serialization with a zero placeholder — the approximation is intentional to avoid circular dependency in the computation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test description mismatch for leaf node test**
- **Found during:** Task 1 (impact.test.ts RED → GREEN)
- **Issue:** Test described "leaf file with no reverse deps" but the fixture file `c.ts` actually had `b.ts` as a reverse dep (b imports c). Test was failing with `expected 1, received 3` — the implementation was correct, the fixture was wrong.
- **Fix:** Changed the test to use `a.ts` as the seed (nothing imports `a.ts` in the A→B→C chain), matching the "leaf in the reverse direction" semantic correctly.
- **Files modified:** `tests/graph/impact.test.ts`
- **Verification:** All 7 impact tests pass
- **Committed in:** `00b8731` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug — test fixture mismatch)
**Impact on plan:** Test fixture bug caught during RED→GREEN; fix was trivial and correct. No scope creep.

## Issues Encountered

None beyond the test fixture bug documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `transitiveClosure`, `renderTree`, and `renderJson` are all ready for Phase 3 CLI/MCP consumption
- Phase 3 can wire `computePageRank` + `renderTree` directly into the `graft context` command
- Phase 3 can wire `transitiveClosure` into the `graft impact` command
- No blockers

## Self-Check: PASSED

All 7 expected files present. Both task commits verified (00b8731, 0925e3e).

---
*Phase: 02-graph-renderer*
*Completed: 2026-03-28*
