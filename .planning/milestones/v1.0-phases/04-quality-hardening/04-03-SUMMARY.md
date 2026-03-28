---
phase: 04-quality-hardening
plan: 03
subsystem: testing
tags: [vitest, v8-coverage, mcp, InMemoryTransport, tree-sitter, python, typescript]

# Dependency graph
requires:
  - phase: 04-quality-hardening
    plan: 01
    provides: createGraftServer factory function, integration fixtures, ts-project fixture

provides:
  - 8 E2E MCP tests via InMemoryTransport covering all 5 tools + 2 resources (QUAL-04)
  - Targeted coverage tests closing parser, graph, cache, renderer, and mcp branches (QUAL-01)
  - pnpm test:coverage passes all thresholds: lines 94.48% (≥90%), functions 97.24% (≥90%), branches 80.08% (≥80%)

affects: [04-quality-hardening phase-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "InMemoryTransport E2E: createGraftServer() + Client + InMemoryTransport.createLinkedPair() for in-process MCP testing"
    - "Fixture-driven branch coverage: adding fixtures (decorator_calls.py, namespace_import.ts, package.json) to exercise specific grammar branches"
    - "Null-path coverage: EISDIR (directory named cache.json) to trigger non-ENOENT cache read error"
    - "Edge-case ?? branch coverage: files absent from scores map trigger ?? 0 null branches in sort comparators"

key-files:
  created:
    - tests/mcp/e2e.test.ts
    - tests/parser/coverage.test.ts
    - tests/graph/coverage.test.ts
    - tests/cache/coverage.test.ts
    - tests/renderer/coverage.test.ts
    - tests/fixtures/python/advanced_imports.py
    - tests/fixtures/python/decorator_calls.py
    - tests/fixtures/typescript/namespace_import.ts
    - tests/fixtures/integration/ts-project/package.json
  modified:
    - tests/mcp/e2e.test.ts (extended with 8 additional test cases for branch coverage)

key-decisions:
  - "E2E tests cover server.ts ?? branches via fixture package.json with only dependencies (no devDependencies), triggering devDependencies ?? {} null path"
  - "EISDIR trick (mkdir cache.json) used to trigger non-ENOENT readFile error in cache/index.ts line 113"
  - "ts-project/package.json added (only dependencies, no devDependencies) to exercise handleGraftSummary try-success path and pkg.devDependencies ?? {} branch"
  - "decorator_calls.py fixture with @dataclass(frozen=True) covers python.ts line 50 call-type decorator branch"
  - "namespace_import.ts fixture with import * as / import default / export { } from covers TS namespace_import and export_clause branches"

requirements-completed: [QUAL-01, QUAL-04]

# Metrics
duration: 24min
completed: 2026-03-28
---

# Phase 4 Plan 3: E2E MCP Tests + Coverage Gap Closure Summary

**E2E MCP testing via InMemoryTransport covering all 5 tools and 2 resources, plus targeted branch coverage tests pushing all thresholds above 90%/90%/80%**

## Performance

- **Duration:** 24 min
- **Started:** 2026-03-28T17:49:14Z
- **Completed:** 2026-03-28T18:13:00Z
- **Tasks:** 2
- **Files modified:** 9 created, 1 modified

## Accomplishments

- 16 E2E tests via InMemoryTransport covering all 5 tools, 2 resources, singular/plural forms, (none) sections, budget override, and nonexistent-path fallback
- pnpm test:coverage passes all configured thresholds — lines 94.48%, functions 97.24%, branches 80.08%
- Targeted unit tests for 5 modules: parser/index.ts, parser/languages/python.ts, parser/languages/typescript.ts, graph/index.ts, cache/index.ts, renderer/tree.ts, renderer/json.ts
- 5 new test fixtures: advanced_imports.py (wildcard/aliased imports), decorator_calls.py (call-type decorators), namespace_import.ts (namespace/default/export), ts-project/package.json (tech stack branch coverage)

## Task Commits

1. **Task 1: E2E MCP tests via InMemoryTransport** - `8d3832e` (test)
2. **Task 2: Coverage gap closure** - `9a9b2be` (test)

## Files Created/Modified

- `tests/mcp/e2e.test.ts` — 16 E2E tests: all 5 tools + 2 resources + singular/plural forms + branch-coverage edge cases
- `tests/parser/coverage.test.ts` — Error paths, empty array, Python wildcard/aliased/call-decorator imports, TS namespace/default/export
- `tests/graph/coverage.test.ts` — Bare npm imports, missing-file drops, Python multi-dot relative imports to __init__.py, bare-path resolution
- `tests/cache/coverage.test.ts` — Corrupted JSON, EISDIR throw, missing-fingerprint, stat-fail, version mismatch
- `tests/renderer/coverage.test.ts` — ?? 0 null-score branches in tree and json sort comparators
- `tests/fixtures/python/advanced_imports.py` — Wildcard + aliased + plain-aliased imports
- `tests/fixtures/python/decorator_calls.py` — @dataclass(frozen=True) call-type decorator
- `tests/fixtures/typescript/namespace_import.ts` — import * as, import default, export { } from, export * from
- `tests/fixtures/integration/ts-project/package.json` — Minimal package.json (only dependencies, no devDependencies)

## Decisions Made

- Added `package.json` to ts-project fixture with only `dependencies` (no `devDependencies`) to cover the `pkg.devDependencies ?? {}` null branch in `handleGraftSummary` — the devDependencies key is absent, triggering the `??` fallback
- Used EISDIR (mkdir named cache.json) instead of chmod to trigger non-ENOENT error — portable across all platforms without needing root access
- Covered `defs.length === 0`, `forward.size === 0`, `reverse.size === 0` branches in `buildFileContextText` by calling `graft_context` on a path not in the graph
- Covered `matches.length === 1` singular branch by querying `buildUserList` (unique function name in fixture)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Graph API changed: node.name is module path, not node.references**
- **Found during:** Task 2 (graph/coverage.test.ts)
- **Issue:** Working tree has `src/graph/index.ts` modified to use `node.name` as module path instead of iterating `node.references`. The coverage tests were written for the old API.
- **Fix:** Updated `tests/graph/coverage.test.ts` to use `node.name` for module paths (import nodes use name for the module path, references for imported identifiers)
- **Files modified:** tests/graph/coverage.test.ts
- **Verification:** All 7 graph coverage tests pass
- **Committed in:** 9a9b2be (Task 2 commit)

**2. [Rule 2 - Missing Critical] Renderer branch coverage added beyond plan scope**
- **Found during:** Task 2 (full coverage run)
- **Issue:** After closing parser/graph/cache gaps, branches were still at 75-76% (needed 80%). The renderer and MCP server had `?? 0` null branches and additional paths uncovered.
- **Fix:** Added `tests/renderer/coverage.test.ts` and extended E2E tests with edge cases (nonexistent path, singular forms, budget, package.json coverage)
- **Files modified:** tests/renderer/coverage.test.ts, tests/mcp/e2e.test.ts, tests/fixtures/integration/ts-project/package.json
- **Verification:** pnpm test:coverage exits 0 with branches 80.08% ≥ 80%
- **Committed in:** 9a9b2be (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug/API change, 1 missing critical coverage for threshold)
**Impact on plan:** Both auto-fixes necessary to meet the phase gate threshold. No scope creep — all additions directly serve the 80% branch coverage requirement.

## Issues Encountered

- `tests/integration/pipeline.test.ts` and `tests/graph/build.test.ts` are untracked modified files with a different graph API (node.name vs node.references). These tests fail pre-existing. Documented as out-of-scope deferred issue.
- `tests/integration/stdout.test.ts` CLI subprocess test is non-deterministic (passes ~70% of runs). Pre-existing issue unrelated to this plan.
- V8 branch coverage for null-guard `continue` statements (e.g., `if (child === null) continue` in tree-sitter AST loops) is impossible to cover in practice — tree-sitter never returns null named children for valid grammar nodes. These ~8 branches remain uncovered but are below the 80% threshold requirement.

## Next Phase Readiness

- Phase 4 quality gate is met: all coverage thresholds pass
- QUAL-01 and QUAL-04 requirements are complete
- All 5 MCP tools and 2 resources have E2E test coverage via InMemoryTransport
- No blockers for phase completion

## Self-Check: PASSED

- tests/mcp/e2e.test.ts: FOUND
- tests/parser/coverage.test.ts: FOUND
- tests/graph/coverage.test.ts: FOUND
- tests/cache/coverage.test.ts: FOUND
- commit 8d3832e: FOUND
- commit 9a9b2be: FOUND
- pnpm test:coverage: lines 94.61%, functions 97.24%, branches 80.08% — all thresholds met

---
*Phase: 04-quality-hardening*
*Completed: 2026-03-28*
