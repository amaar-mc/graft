---
phase: 03-cli-mcp
plan: 01
subsystem: indexer
tags: [mcp, commander, chalk, ora, zod, pipeline, cache, pagerank]

# Dependency graph
requires:
  - phase: 01-foundation-parser
    provides: discoverFiles, parseFiles, ParseResult types, cache read/write/validate
  - phase: 02-graph-renderer
    provides: buildGraph, computePageRank, FileGraph, PageRankResult types
provides:
  - buildIndex() shared pipeline function in src/indexer/pipeline.ts
  - All Phase 3 runtime deps (@modelcontextprotocol/sdk, zod@3, chalk@4, ora@5, commander@14)
affects: [03-cli-mcp]

# Tech tracking
tech-stack:
  added:
    - "@modelcontextprotocol/sdk@1.28.0"
    - "zod@3.25.76"
    - "commander@14.0.3"
    - "chalk@4.1.2"
    - "ora@5.4.1"
  patterns:
    - "Single buildIndex() entry point: CLI and MCP share one pipeline — no duplication"
    - "Cache-first pipeline: always check cache before parsing — skip I/O on cache hits"

key-files:
  created:
    - src/indexer/pipeline.ts
    - tests/indexer/pipeline.test.ts
  modified:
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "chalk pinned to v4.x (not v5+): v5+ is ESM-only, breaks CJS bundle"
  - "ora pinned to v5.x (not v6+): v6+ is ESM-only, breaks CJS bundle"
  - "zod pinned to v3.x (not v4): v4 crashes MCP SDK v1 at runtime"
  - "buildIndex returns all four fields (graph, scores, files, results): downstream consumers need full access to each stage output"

patterns-established:
  - "Pipeline pattern: discover -> cache-check -> parse-or-deserialize -> build-graph -> rank"
  - "TDD: failing test commit before implementation commit"

requirements-completed:
  - CLI-06

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 3 Plan 01: Dependencies and Shared Indexing Pipeline Summary

**Five CJS-compatible Phase 3 deps installed and buildIndex() pipeline extracting discover-cache-parse-graph-rank into a single shared entry point**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-28T09:41:00Z
- **Completed:** 2026-03-28T09:43:07Z
- **Tasks:** 3 (Task 3 was a verification pass — no files modified)
- **Files modified:** 4 (package.json, pnpm-lock.yaml, src/indexer/pipeline.ts, tests/indexer/pipeline.test.ts)

## Accomplishments
- All 5 Phase 3 runtime deps installed at CJS-safe versions (chalk@4, ora@5, zod@3, commander@14, @modelcontextprotocol/sdk@1.28)
- `buildIndex()` implemented with full cache-hit, cache-miss, and stale-cache paths
- 22 new unit tests covering all pipeline paths, personalization passthrough, return shape, and pipeline ordering
- Build verified clean with zero ESM-only errors — all new deps bundle to CJS without issues

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Phase 3 dependencies** - `5ceb62a` (chore)
2. **Task 2: Create shared indexing pipeline (RED)** - `71231b9` (test)
3. **Task 2: Create shared indexing pipeline (GREEN)** - `686bd5c` (feat)
4. **Task 3: Verify tsup config** - verification pass, no files changed

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/indexer/pipeline.ts` - Shared buildIndex() pipeline: discover -> cache check -> parse -> graph -> pagerank
- `tests/indexer/pipeline.test.ts` - 22 unit tests for all pipeline paths using vi.mock()
- `package.json` - Added 5 Phase 3 runtime dependencies
- `pnpm-lock.yaml` - Updated lockfile with new deps

## Decisions Made
- chalk and ora pinned to v4/v5 respectively — v5+/v6+ are ESM-only and would break the CJS tsup bundle
- zod pinned to v3 — confirmed v4 breaks MCP SDK v1 at runtime (pre-existing project decision reinforced)
- `buildIndex` returns all four fields (graph, scores, files, results) — downstream CLI commands and MCP tools need direct access to each stage's output without re-running the pipeline

## Deviations from Plan

None - plan executed exactly as written. Task 3 was a verification pass as expected — no tsup config changes were needed.

## Issues Encountered
None — all deps installed without conflicts and the CJS bundle built cleanly on first attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `buildIndex()` ready for consumption by CLI commands (Plan 03-02) and MCP server (Plan 03-03)
- All Phase 3 deps available in node_modules
- tsup CJS build verified clean with all new dependencies
- No blockers

## Self-Check: PASSED

- src/indexer/pipeline.ts — FOUND
- tests/indexer/pipeline.test.ts — FOUND
- .planning/phases/03-cli-mcp/03-01-SUMMARY.md — FOUND
- Commit 5ceb62a (chore: install deps) — FOUND
- Commit 71231b9 (test: failing pipeline tests) — FOUND
- Commit 686bd5c (feat: implement pipeline) — FOUND

---
*Phase: 03-cli-mcp*
*Completed: 2026-03-28*
