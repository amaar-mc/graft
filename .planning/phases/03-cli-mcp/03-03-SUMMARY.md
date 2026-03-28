---
phase: 03-cli-mcp
plan: 03
subsystem: cli
tags: [cli, commander, chalk, ora, tdd, commander, subcommands]

# Dependency graph
requires:
  - phase: 03-cli-mcp
    plan: 01
    provides: buildIndex shared pipeline
  - phase: 02-graph-renderer
    provides: renderTree, transitiveClosure, FileGraph
  - phase: 01-foundation-parser
    provides: readCache, GraftError, NodeKind types
provides:
  - Commander-based CLI at src/cli/index.ts with all 5 subcommands
  - Exported handler functions (handleMap, handleStats, handleImpact, handleSearch) for testability
  - Unit tests for all 4 non-serve command handlers
affects: [03-cli-mcp]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Handler extraction pattern: named async functions exported alongside Commander registrations — testable without spawning CLI"
    - "Dynamic import for MCP server in serve command — avoids pulling MCP SDK into map/stats/impact/search code paths"
    - "require() for package.json version — works in both Vitest test context (src/) and CJS dist context (dist/)"

key-files:
  created:
    - tests/cli/commands.test.ts
  modified:
    - src/cli/index.ts

key-decisions:
  - "require() instead of readFileSync for package.json: resolves path differently in test (src/cli/) vs dist (dist/) contexts — require() resolves from module location correctly in both"
  - "Dynamic import of startMcpServer inside serve action handler: prevents MCP SDK from being loaded on map/stats/impact/search command invocations"
  - "All spinner output uses { stream: process.stderr }: prevents stdout contamination that would break MCP JSON-RPC sessions"

# Metrics
duration: 15min
completed: 2026-03-28
---

# Phase 3 Plan 03: Commander CLI with All Subcommands Summary

**Commander CLI with serve (default), map, stats, impact, and search commands — all handler logic exported and unit tested; no stdout contamination from spinners or logging**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-28T09:47:00Z
- **Completed:** 2026-03-28T10:02:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2 (src/cli/index.ts, tests/cli/commands.test.ts)

## Accomplishments

- Replaced the minimal Phase 1 CLI with a full Commander-based CLI implementing all 5 subcommands
- `serve` uses `isDefault: true` so `npx graft` with no args starts the MCP server
- `map`, `stats`, `impact`, `search` all write final output to stdout; all spinners and logging go to stderr
- Exported `handleMap`, `handleStats`, `handleImpact`, `handleSearch` enable unit testing without spawning the CLI binary
- 24 unit tests covering all command paths: personalization, budget, cache age, impact sort order, search filtering
- Build produces working `dist/index.cjs` — `--help` and `--version` verified against built output
- Zero `console.log` calls in `src/cli/index.ts`

## Task Commits

Each phase committed atomically:

1. **RED: failing CLI tests** - `7693225` (test)
2. **GREEN: implement CLI + fix test precision** - `c2dd5c9` (feat)

## Files Created/Modified

- `src/cli/index.ts` — Commander CLI with serve (default), map, stats, impact, search commands; exports handler functions
- `tests/cli/commands.test.ts` — 24 unit tests for handleMap, handleStats, handleImpact, handleSearch

## Decisions Made

- `require()` used for `package.json` version loading: `readFileSync` with `__dirname` produces different relative paths in Vitest test context (`src/cli/`) vs built CJS output (`dist/`). `require()` resolves correctly in both contexts
- Dynamic import of `startMcpServer` inside serve action: defers loading the MCP SDK until the serve command is actually invoked — lighter startup for map/stats/impact/search
- `{ stream: process.stderr }` on all `ora()` calls: critical for preventing stdout contamination in MCP server mode

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed package.json path resolution for both test and built contexts**
- **Found during:** Task 1 (GREEN verification)
- **Issue:** Plan spec used `readFileSync(path.join(__dirname, '../../package.json'))`. `__dirname` in Vitest is `src/cli/` — two levels up gives `package.json` correctly. But in built CJS output `__dirname` is `dist/` — two levels up gives the parent of the project root (wrong). Conversely, one level up (`../package.json`) works in dist but fails in tests.
- **Fix:** Used `require('../../package.json')` which CJS `require` resolves from the source file location correctly in both environments
- **Files modified:** `src/cli/index.ts`
- **Commit:** `c2dd5c9`

**2. [Rule 1 - Bug] Fixed test precision for sort order and kind filter assertions**
- **Found during:** Task 1 (GREEN run)
- **Issue:** `handleImpact` sort test checked `indexOf('b.ts') > indexOf('a.ts')` but the header line "Impact analysis: b.ts" appeared before the results, making b.ts index smaller. `handleSearch` kind filter test used `not.toContain('Bar')` but the header "Search results for Bar" contained the query string
- **Fix:** Narrowed assertions to check only the indented results lines (starting with `'  '`) rather than the full output string
- **Files modified:** `tests/cli/commands.test.ts`
- **Commit:** `c2dd5c9`

## Issues Encountered

None requiring escalation.

## User Setup Required

None.

## Next Phase Readiness

- `src/cli/index.ts` exports all handler functions plus the Commander program
- `serve` command dynamically imports `src/mcp/server.ts` — plan 03-02 provides that module
- Build verified clean; `dist/index.cjs` responds correctly to `--help` and `--version`
- All 228 tests passing (CLI + all prior phases)

## Self-Check: PASSED

- src/cli/index.ts — FOUND
- tests/cli/commands.test.ts — FOUND
- .planning/phases/03-cli-mcp/03-03-SUMMARY.md — FOUND
- Commit 7693225 (test: failing CLI tests) — FOUND
- Commit c2dd5c9 (feat: implement CLI) — FOUND

---
*Phase: 03-cli-mcp*
*Completed: 2026-03-28*
