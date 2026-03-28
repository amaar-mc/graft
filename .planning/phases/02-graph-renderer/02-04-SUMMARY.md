---
phase: 02-graph-renderer
plan: 04
subsystem: infra
tags: [cache, fingerprint, filesystem, mtime, invalidation]

# Dependency graph
requires:
  - phase: 02-graph-renderer/02-01
    provides: graph build pipeline that cache will accelerate
  - phase: 01-foundation-parser
    provides: ParseResult/CodeNode types that cache serializes
provides:
  - Filesystem cache (readCache, writeCache, isCacheValid, deserializeResults) at src/cache/index.ts
  - mtime+size fingerprinting per file for stale-detection
  - Relative path storage for cross-machine portability
  - CACHE_VERSION constant for full invalidation on schema change
  - CacheError class in src/errors.ts
affects:
  - 03-cli: will call readCache/writeCache to skip re-parsing on fast restart
  - 04-mcp: same fast-restart benefit via cache layer

# Tech tracking
tech-stack:
  added: []  # no new runtime dependencies; uses Node.js built-ins only
  patterns:
    - "Write relative paths to cache, restore absolute on read — portability across machines"
    - "CACHE_VERSION bump as full invalidation gate — cheap schema evolution"
    - "mtime+size fingerprint pair — avoids hash computation overhead on large repos"

key-files:
  created:
    - src/cache/index.ts
    - tests/cache/cache.test.ts
  modified:
    - src/errors.ts

key-decisions:
  - "mtime+size fingerprint chosen over content hash — O(1) stat vs O(n) read for large files; acceptable false-negative rate on clock-skew edge cases"
  - "Stale cache never returned silently — any fingerprint mismatch returns false from isCacheValid, caller decides what to do"
  - "Relative paths in cache.json — projects can be moved between machines and cache remains valid when re-pointing rootDir"
  - "No new runtime dependencies — cache uses only fs/promises and path from Node.js builtins"

patterns-established:
  - "CacheError extends GraftError: follows existing error hierarchy pattern in src/errors.ts"
  - "readCache returns null (not throws) for missing/malformed cache — callers treat null as cache miss"
  - "isCacheValid is pure async predicate — no side effects, single responsibility"

requirements-completed: [INFRA-03]

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 2 Plan 04: Cache Summary

**Filesystem cache writing ParseResult[] with mtime+size fingerprints to .graft/cache.json for zero-cost fast restart on unchanged repos**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-28T08:31:31Z
- **Completed:** 2026-03-28T08:33:15Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- `readCache`/`writeCache` serialize ParseResult[] with per-file mtime+size fingerprints to `.graft/cache.json`
- `isCacheValid` detects all invalidation cases: changed mtime, changed size, added files, deleted files, version mismatch
- Relative path storage ensures cache portability across machines and directory moves
- `deserializeResults` restores absolute paths on read so upstream consumers are unaware of serialization detail
- 14 tests cover all behaviors; TypeScript strict mode passes; no new runtime dependencies

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing tests for cache read/write** - `6d06c58` (test)
2. **Task 1 (GREEN): cache implementation + CacheError** - `897ffc0` (feat)

**Plan metadata:** (docs commit below)

_Note: TDD task split into RED (test) and GREEN (impl) commits as per TDD protocol_

## Files Created/Modified

- `src/cache/index.ts` — readCache, writeCache, isCacheValid, deserializeResults with CACHE_VERSION=1
- `tests/cache/cache.test.ts` — 14 tests covering all invalidation and roundtrip scenarios
- `src/errors.ts` — Added CacheError class

## Decisions Made

- mtime+size fingerprint pair chosen over content hash: stat() is O(1), hashing requires reading entire file. On a 100K LOC repo with thousands of files, this is a meaningful performance difference. The false-negative rate (clock-skew causing a valid cache to be treated as stale) is acceptable — worst case is a re-parse, not incorrect results.
- `readCache` returns `null` rather than throwing for missing/malformed cache — callers (CLI, MCP) can treat null uniformly as "cache miss, parse everything".
- No new runtime dependencies — uses only `fs/promises` and `path` from Node.js builtins, keeping the `npx` install size minimal.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Cache layer ready for Phase 3 CLI integration: call `readCache` → `isCacheValid` → skip parse if valid; call `writeCache` after parse completes
- `deserializeResults` provides the restored ParseResult[] interface Phase 3 CLI and Phase 4 MCP expect
- No blockers

---
*Phase: 02-graph-renderer*
*Completed: 2026-03-28*
