---
phase: 04-quality-hardening
plan: 02
subsystem: tests
tags: [integration-tests, snapshot-tests, pipeline, renderer, graph-builder, bug-fix]
dependency_graph:
  requires: ["04-01"]
  provides: ["integration-test-coverage", "renderer-snapshot-baseline"]
  affects: ["src/graph/index.ts", "tests/graph/build.test.ts", "tests/graph/queries.test.ts"]
tech_stack:
  added: []
  patterns: ["vitest snapshots", "afterEach cache cleanup", "in-memory graph fixtures"]
key_files:
  created:
    - tests/integration/pipeline.test.ts
    - tests/renderer/tree-snapshot.test.ts
    - tests/renderer/__snapshots__/tree-snapshot.test.ts.snap
  modified:
    - src/graph/index.ts
    - tests/graph/build.test.ts
    - tests/graph/queries.test.ts
decisions:
  - "buildGraph reads node.name (not node.references) for import/export module paths — all parsers consistently store module path in name field"
  - "Snapshot budget=20 tokens (charBudget=60) demonstrates truncation with fileA included but fileB excluded"
  - "afterEach cache cleanup with fs.rmSync prevents cross-test contamination from .graft/cache.json"
metrics:
  duration: "8 minutes"
  completed: "2026-03-28"
  tasks_completed: 2
  files_changed: 6
---

# Phase 4 Plan 2: Integration Tests and Snapshot Tests Summary

One-liner: Integration tests validate full buildIndex pipeline across TS/Python/mixed fixtures; snapshot tests lock tree renderer formatting; fixed graph builder bug where import edges were never created.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Integration tests for buildIndex pipeline | 7faf29e | tests/integration/pipeline.test.ts, src/graph/index.ts, tests/graph/build.test.ts, tests/graph/queries.test.ts |
| 2 | Snapshot tests for tree renderer | 993784e | tests/renderer/tree-snapshot.test.ts, tests/renderer/__snapshots__/tree-snapshot.test.ts.snap |

## What Was Built

### Task 1: Integration Tests (QUAL-02)

`tests/integration/pipeline.test.ts` — 3 describe blocks, 14 assertions total:

- **TypeScript project fixture** (`tests/fixtures/integration/ts-project/`): validates 3 files discovered, forward edges index.ts→utils.ts, index.ts→types.ts, utils.ts→types.ts, types.ts ranks higher than index.ts (PageRank), all files have definitions
- **Python project fixture** (`tests/fixtures/integration/python-project/`): validates 3+ files, main.py→models.py edge, __init__.py→models.py edge, models.py ranks higher than main.py, ≥2 class definitions from models.py
- **Mixed-language project fixture** (`tests/fixtures/integration/mixed-project/`): validates 4+ files from both languages, app.ts→helpers.ts edge, config.py→utils.py edge, zero cross-language edges (TS→PY and PY→TS both checked)

### Task 2: Snapshot Tests (QUAL-03)

`tests/renderer/tree-snapshot.test.ts` — 5 snapshot scenarios:

1. **Standard 3-file graph** — 3 files with definitions, scores [0.5, 0.3, 0.1], captures score formatting and definition indentation
2. **Headers-only graph** — 3 files with no definitions, captures header-only output
3. **Single-file graph** — 1 file with 3 definitions (function, interface, constant)
4. **Tight budget truncation** — tokenBudget=20 (charBudget=60): fileA (48 chars) fits, fileB (49 chars) would overflow, so only fileA appears
5. **Empty graph** — produces only `[~0 tokens]` footer

All graphs built from hard-coded in-memory data per research pitfall 2 (no filesystem fixtures to avoid PageRank decimal drift).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed graph builder reading wrong field for import/export module paths**

- **Found during:** Task 1 execution — all edge assertions failed (forward edges were empty for all files)
- **Issue:** `buildGraph` iterated `node.references` to find module paths for import/export nodes. But all parsers (TypeScript, Python) store the module path in `node.name` and store imported identifiers in `node.references`. The existing unit tests used synthetic data that matched the buggy expectation (`references = ['./b']`), so they passed despite the real pipeline producing zero edges.
- **Fix:** Changed `buildGraph` to resolve `node.name` as the module path for import/export nodes. Updated `tests/graph/build.test.ts` and `tests/graph/queries.test.ts` synthetic fixtures to the correct structure (module path in `name`, identifiers in `references`).
- **Files modified:** `src/graph/index.ts`, `tests/graph/build.test.ts`, `tests/graph/queries.test.ts`
- **Commit:** 7faf29e

## Verification

```
Test Files  28 passed (28)
     Tests  295 passed (295)
```

All new integration and snapshot tests pass. All previously passing tests still pass.

## Self-Check

Files exist:
- tests/integration/pipeline.test.ts: FOUND
- tests/renderer/tree-snapshot.test.ts: FOUND
- tests/renderer/__snapshots__/tree-snapshot.test.ts.snap: FOUND

Commits:
- 7faf29e: FOUND
- 993784e: FOUND
