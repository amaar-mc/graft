---
phase: 01-foundation-parser
plan: 02
subsystem: infra
tags: [fast-glob, ignore, gitignore, graftignore, file-discovery, indexer]

# Dependency graph
requires:
  - phase: 01-foundation-parser/01-01
    provides: DiscoveryError class, logger (info/debug), project scaffold with fast-glob and ignore deps

provides:
  - discoverFiles() async function in src/indexer/discovery.ts
  - gitignore-aware, graftignore-aware, zero-config file discovery
  - Default ignore rules for node_modules/dist/build/.git/vendor and minified/type-definition files
  - Absolute sorted paths for all .ts/.tsx/.js/.mjs/.cjs/.py files in a directory tree

affects:
  - parser pipeline (src/parser/*) — all files it processes come through discoverFiles
  - CLI (src/cli/*) — entry point for index command
  - indexer pipeline — next plans that build on file enumeration

# Tech tracking
tech-stack:
  added: []  # fast-glob and ignore were already in package.json from plan 01-01
  patterns:
    - "ignore package with relative paths for gitignore-compatible filtering"
    - "fast-glob with absolute:true for enumeration, ignore instance for post-filter"
    - "TDD red-green cycle: failing tests committed before implementation"
    - "Default ignore dirs applied at both glob level and ignore instance level for defense-in-depth"

key-files:
  created:
    - src/indexer/discovery.ts
    - tests/indexer/discovery.test.ts
  modified: []

key-decisions:
  - "fast-glob handles enumeration, ignore handles filtering — separation of concerns avoids glob pattern complexity for negation rules"
  - "Default dirs applied at both glob ignore and ignore instance levels — glob for perf, instance for .gitignore negation correctness"
  - "extraIgnorePatterns defaults to empty readonly array — no optional/undefined ambiguity"

patterns-established:
  - "Discovery pattern: fast-glob enumerate + ignore filter + alphabetical sort"
  - "Ignore file loading: read .gitignore and .graftignore via readIgnoreFile helper; null means absent (not an error)"
  - "Error pattern: validate preconditions before async work, throw typed error with actionable hint"

requirements-completed:
  - INFRA-01
  - INFRA-02
  - INFRA-04

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 1 Plan 02: File Discovery Summary

**fast-glob + ignore-based discoverFiles() that finds .ts/.tsx/.js/.mjs/.cjs/.py files with zero-config default ignores, .gitignore, and .graftignore support**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T07:33:16Z
- **Completed:** 2026-03-28T07:34:54Z
- **Tasks:** 1 (TDD: 2 commits — test RED + feat GREEN)
- **Files modified:** 2

## Accomplishments

- discoverFiles() function that works out-of-the-box with zero config
- Default ignores applied for node_modules, dist, build, .next, out, coverage, __pycache__, .venv, venv, .git, vendor, and file patterns *.min.js, *.d.ts, *.map, *.bundle.js
- .gitignore loaded and respected including negation patterns (e.g., !src/important.generated.ts)
- .graftignore loaded and respected for graft-specific overrides
- extraIgnorePatterns argument for CLI-supplied patterns
- 14 test cases pass covering all behaviors including edge cases (empty dir, non-existent dir, negation)

## Task Commits

1. **Task 1 RED: add failing tests** - `2537693` (test)
2. **Task 1 GREEN: implement discoverFiles** - `b6e797f` (feat)

_TDD task: test commit precedes implementation commit._

## Files Created/Modified

- `src/indexer/discovery.ts` — discoverFiles() function with fast-glob enumeration and ignore filtering
- `tests/indexer/discovery.test.ts` — 14 Vitest test cases covering all behaviors

## Decisions Made

- Used separate fast-glob ignore and ignore instance layering: fast-glob skips default dirs at glob level (performance), ignore instance handles all patterns including negation (correctness). This ensures .gitignore negation patterns like `!src/important.generated.ts` override the base `*.generated.ts` rule correctly.
- `extraIgnorePatterns` defaults to empty array (`readonly string[] = []`) rather than optional `?` — avoids undefined handling in the loop.

## Deviations from Plan

None - plan executed exactly as written.

Pre-existing out-of-scope issues logged to `deferred-items.md`:
- TypeScript errors in `src/parser/tree-sitter.ts` — web-tree-sitter WASM API type mismatches from plan 01-01, unrelated to file discovery.

## Issues Encountered

None — fast-glob and ignore packages were already installed from plan 01-01. Implementation matched plan specification exactly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- discoverFiles() is ready to be imported by the indexer pipeline and CLI
- The function's contract is: rootDir + optional extra patterns in → absolute sorted source file paths out
- Pre-existing TypeScript errors in src/parser/tree-sitter.ts (WASM API types) will need resolution in a subsequent parser plan

---
*Phase: 01-foundation-parser*
*Completed: 2026-03-28*

## Self-Check: PASSED

- FOUND: src/indexer/discovery.ts
- FOUND: tests/indexer/discovery.test.ts
- FOUND: .planning/phases/01-foundation-parser/01-02-SUMMARY.md
- FOUND commit: 2537693 (test RED)
- FOUND commit: b6e797f (feat GREEN)
