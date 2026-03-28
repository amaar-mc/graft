---
phase: 04-quality-hardening
plan: 01
subsystem: testing
tags: [vitest, tree-sitter, typescript, python, fixtures, mcp, error-handling, logging]

# Dependency graph
requires:
  - phase: 03-cli-mcp
    provides: MCP server with startMcpServer, tool handlers, and exported functions
provides:
  - Integration fixture codebases (ts-project, python-project, mixed-project) for downstream E2E tests
  - createGraftServer() extracted from startMcpServer for in-process E2E testing with InMemoryTransport
  - Unit tests for all GraftError subclasses (errors.test.ts)
  - Unit tests for warn() and error() logger functions (logger.test.ts)
affects:
  - 04-02: Integration tests use these fixture directories
  - 04-03: E2E tests use createGraftServer with InMemoryTransport
  - 04-04: Coverage report will include errors.ts and logger.ts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Integration fixtures as self-contained multi-file projects with real cross-file imports
    - createGraftServer/startMcpServer split — factory returns configured server, entry point connects transport
    - stderr spy via vi.spyOn(process.stderr, 'write') for logger unit tests

key-files:
  created:
    - tests/fixtures/integration/ts-project/types.ts
    - tests/fixtures/integration/ts-project/utils.ts
    - tests/fixtures/integration/ts-project/index.ts
    - tests/fixtures/integration/python-project/models.py
    - tests/fixtures/integration/python-project/__init__.py
    - tests/fixtures/integration/python-project/main.py
    - tests/fixtures/integration/mixed-project/helpers.ts
    - tests/fixtures/integration/mixed-project/app.ts
    - tests/fixtures/integration/mixed-project/utils.py
    - tests/fixtures/integration/mixed-project/config.py
    - tests/errors.test.ts
    - tests/logger.test.ts
  modified:
    - src/mcp/server.ts

key-decisions:
  - "createGraftServer returns McpServer without transport — Option B from research; zero production API change"
  - "Mixed-project fixture uses two separate clusters (TS + Python) to assert no cross-language edges per research pitfall 5"

patterns-established:
  - "Factory pattern for MCP server: createGraftServer() configures, startMcpServer() wires transport"
  - "Integration fixtures: small (10-25 line) parseable files with real imports, not pseudo-code"

requirements-completed:
  - QUAL-01
  - QUAL-02
  - QUAL-04

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 4 Plan 01: Quality Hardening Wave 0 Prereqs Summary

**Integration fixture codebases (TS/Python/mixed) plus createGraftServer factory extraction enabling in-process MCP E2E testing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T17:44:15Z
- **Completed:** 2026-03-28T17:46:41Z
- **Tasks:** 2
- **Files modified:** 13 (12 created + 1 modified)

## Accomplishments

- Created 3 integration fixture codebases under tests/fixtures/integration/ with real cross-file imports parseable by tree-sitter
- Extracted createGraftServer(rootDir): McpServer from startMcpServer — factory pattern enables E2E tests via InMemoryTransport without spawning subprocess
- Added tests/errors.test.ts covering all 5 GraftError subclasses (GraftError, ParseError, DiscoveryError, GrammarLoadError, CacheError) with prototype chain assertions
- Added tests/logger.test.ts covering warn() and error() functions using stderr spy

## Task Commits

Each task was committed atomically:

1. **Task 1: Create integration fixtures and close error/logger coverage gaps** - `df0f9bf` (feat)
2. **Task 2: Extract createGraftServer from startMcpServer** - `5762672` (refactor)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `tests/fixtures/integration/ts-project/types.ts` - User/Config interfaces and UserId type; no local imports
- `tests/fixtures/integration/ts-project/utils.ts` - createUser/formatUser/applyConfig; imports from ./types
- `tests/fixtures/integration/ts-project/index.ts` - buildUserList/describeUsers; imports from ./types and ./utils
- `tests/fixtures/integration/python-project/models.py` - User and Post classes; no local imports
- `tests/fixtures/integration/python-project/__init__.py` - Barrel re-export from .models
- `tests/fixtures/integration/python-project/main.py` - create_sample_post/describe_post; imports from .models
- `tests/fixtures/integration/mixed-project/helpers.ts` - clamp/slugify TS helpers; no imports
- `tests/fixtures/integration/mixed-project/app.ts` - processConfig TS entry; imports from ./helpers
- `tests/fixtures/integration/mixed-project/utils.py` - clamp/slugify Python utilities; no imports
- `tests/fixtures/integration/mixed-project/config.py` - AppConfig class; imports from .utils
- `tests/errors.test.ts` - Unit tests for all 5 GraftError subclasses
- `tests/logger.test.ts` - Unit tests for warn() and error() via stderr spy
- `src/mcp/server.ts` - Added createGraftServer() factory, startMcpServer delegates to it

## Decisions Made

- createGraftServer returns McpServer without transport — Option B from research. Zero change to production API surface; startMcpServer still works identically.
- Mixed-project fixture deliberately has two disconnected clusters (TS: app.ts -> helpers.ts; Python: config.py -> utils.py) to test the no-cross-language-edges invariant per research pitfall 5.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Self-Check: PASSED

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 3 integration fixture directories ready for Plan 02 (integration tests that run buildIndex against each fixture)
- createGraftServer exported and testable — Plan 03 E2E tests can use InMemoryTransport directly
- errors.ts and logger.ts coverage gaps closed — Plan 04 coverage report will show full coverage for these files
- All 248 existing tests continue to pass

---
*Phase: 04-quality-hardening*
*Completed: 2026-03-28*
