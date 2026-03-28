---
phase: 03-cli-mcp
plan: "04"
subsystem: testing
tags: [mcp, cli, testing, stdout, schema, vitest, child_process]

# Dependency graph
requires:
  - phase: 03-cli-mcp/03-02
    provides: MCP server with 5 tools registered via Zod schemas
  - phase: 03-cli-mcp/03-03
    provides: Commander CLI with map/stats/impact/search/serve commands
provides:
  - MCP-09 schema size guard: test that fails if total tool schemas exceed 4000 chars
  - CLI-06 stream separation guard: subprocess tests verifying stdout/stderr separation
  - INFRA-05 coverage extension: serve command stdout purity added to existing test
affects: [future schema changes to src/mcp/server.ts, CLI output changes to src/cli/index.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - MCP Client + InMemoryTransport pattern for testing MCP servers in-process
    - child_process.spawn pattern for subprocess stdout/stderr stream separation testing
    - FORCE_COLOR=0 env to suppress ANSI codes in test subprocesses

key-files:
  created:
    - tests/mcp/schema-size.test.ts
  modified:
    - tests/integration/stdout.test.ts

key-decisions:
  - "MCP Client + InMemoryTransport used for schema size test: gives exact JSON Schema MCP clients see, not an approximation"
  - "child_process.spawn with separate stdout/stderr pipes used for CLI stream separation: byte-accurate, matches real usage"
  - "serve command tested by closing stdin immediately and asserting stdout empty: avoids needing JSON-RPC handshake in test"

patterns-established:
  - "Schema budget tests: measure JSON.stringify(tools).length from listTools() response, not raw Zod schema objects"
  - "CLI subprocess tests: spawn with FORCE_COLOR=0, separate pipe capture, assert stream routing not content"

requirements-completed:
  - MCP-09
  - CLI-06

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 03 Plan 04: Quality Guard Tests Summary

**MCP Client/InMemoryTransport schema size guard + subprocess stdout/stderr separation tests enforcing MCP-09 and CLI-06 quality requirements**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T16:54:19Z
- **Completed:** 2026-03-28T16:57:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Schema size guard test using real MCP Client + InMemoryTransport measures the exact JSON the client sees — total 5-tool schemas well under 4000 chars
- CLI subprocess stream separation tests spawn the built `dist/index.cjs` and assert map/stats/search output goes to stdout only with no `[graft:` prefix or spinner frames
- Serve command test confirms stdout is empty on startup (no banner or spinner leaks that would corrupt MCP sessions)

## Task Commits

1. **Task 1: MCP schema size guard test** - `7b27717` (test)
2. **Task 2: Extend stdout contamination test for CLI + MCP modes** - `1d27a03` (test)

## Files Created/Modified

- `tests/mcp/schema-size.test.ts` - New: MCP-09 schema size guard using Client + InMemoryTransport
- `tests/integration/stdout.test.ts` - Extended: added 4 CLI subprocess stream separation tests (CLI-06)

## Decisions Made

- MCP Client + InMemoryTransport: most accurate approach — measures actual JSON-RPC schema as sent to clients, not Zod schema objects
- child_process.spawn for subprocess tests: byte-accurate stream separation, same as real usage; FORCE_COLOR=0 disables chalk ANSI in test output
- Serve stdin close: closing stdin immediately causes the MCP server to exit naturally — stdout empty assertion is clean without needing a timeout+kill

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 03-cli-mcp is complete — all 4 plans done
- Schema guard will catch future MCP-09 violations automatically on any tool description/parameter change
- Stdout contamination guard enforces INFRA-05 for all future CLI command additions

---
*Phase: 03-cli-mcp*
*Completed: 2026-03-28*

## Self-Check: PASSED

- tests/mcp/schema-size.test.ts: FOUND
- tests/integration/stdout.test.ts: FOUND
- commit 7b27717 (schema size test): FOUND
- commit 1d27a03 (stdout contamination extension): FOUND
