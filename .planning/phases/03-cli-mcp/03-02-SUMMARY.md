---
phase: 03-cli-mcp
plan: 02
subsystem: mcp
tags: [mcp, zod, @modelcontextprotocol/sdk, stdio, json-rpc, pagerank, tree-sitter]

# Dependency graph
requires:
  - phase: 03-cli-mcp
    plan: 01
    provides: buildIndex() shared pipeline, all Phase 3 runtime deps installed
  - phase: 02-graph-renderer
    provides: renderTree, forwardDeps, reverseDeps, transitiveClosure, FileGraph types
  - phase: 01-foundation-parser
    provides: ParseResult types, CodeNode types, NodeKind types
provides:
  - startMcpServer() in src/mcp/server.ts — wires McpServer to StdioServerTransport
  - handleGraftMap, handleGraftContext, handleGraftSearch, handleGraftImpact, handleGraftSummary — exported handlers for unit testing
  - buildFileContextText — shared helper for context formatting (used by tool and resource)
  - 5 MCP tools: graft_map, graft_context, graft_search, graft_impact, graft_summary
  - 2 MCP resources: graft://map (static), graft://file/{path} (parameterized)
affects: [03-cli-mcp, 03-03, 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Extracted handler functions: each tool's logic is a named async fn exported for unit testing — McpServer registration wraps them"
    - "Shared buildFileContextText: single function serves both graft_context tool and graft://file/{path} resource, avoiding duplication"
    - "CallToolResult SDK type: handler return type uses SDK's own type to satisfy TypeScript overload resolution"
    - "TDD: failing test commit before implementation commit for each task"

key-files:
  created:
    - src/mcp/server.ts
    - tests/mcp/tools.test.ts
    - tests/mcp/resources.test.ts
    - tests/mcp/server.test.ts
  modified: []

key-decisions:
  - "Handler extraction pattern: each tool logic extracted to named async function (handleGraftMap, etc.) and exported — enables unit testing without McpServer"
  - "CallToolResult return type: handlers return CallToolResult (SDK type with index signature) not custom interface — required for TypeScript overload resolution with server.tool()"
  - "graft_summary reads package.json via fs.readFileSync in try/catch — gracefully falls back to 'No package.json detected' rather than throwing"
  - "graft_impact uses transitiveClosure (reverse deps only) not forwardDeps — correct for 'who is affected if I change this file'"

patterns-established:
  - "Handler extraction for testability: register with server.tool(name, desc, schema, (params) => handleFn(params, rootDir))"
  - "Shared formatting helper pattern: buildFileContextText(graph, scores, rootDir, absPath) used by both tool and resource"
  - "Integration test pattern: spawn dist/index.cjs, write JSON-RPC to stdin, collect stdout, parse first valid JSON-RPC response"

requirements-completed:
  - MCP-01
  - MCP-02
  - MCP-03
  - MCP-04
  - MCP-05
  - MCP-06
  - MCP-07
  - MCP-08

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 3 Plan 02: MCP Server with 5 Tools and 2 Resources Summary

**McpServer over StdioServerTransport with 5 tools (graft_map, graft_context, graft_search, graft_impact, graft_summary) and 2 resources (graft://map, graft://file/{path}), all unit tested via extracted handlers and integration tested via spawned binary**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-28T16:45:31Z
- **Completed:** 2026-03-28T16:51:21Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 4 (src/mcp/server.ts, tests/mcp/tools.test.ts, tests/mcp/resources.test.ts, tests/mcp/server.test.ts)

## Accomplishments
- Complete MCP server with 5 tools and 2 resources, all callable and returning correct formatted responses
- 39 passing tests across unit tests (tools, resources) and stdio integration test
- Integration test confirms spawned binary responds to JSON-RPC initialize with correct server name and tools capability
- TypeScript overload resolution issue with SDK's `CallToolResult` type resolved by using SDK type directly instead of custom interface
- `buildFileContextText` shared helper avoids duplication between `graft_context` tool and `graft://file/{path}` resource

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement MCP server with 5 tools (RED)** - `0ac3bef` (test: add failing tests for MCP tool handlers)
2. **Task 1: Implement MCP server with 5 tools (GREEN)** - `098396f` (feat: implement MCP server with 5 tool handlers)
3. **Task 2: Implement MCP resources (test + resources already in server.ts)** - `489cc8a` (test: add tests for MCP resources and buildFileContextText helper)
4. **Task 3: MCP stdio transport integration test** - `9cefd9c` (test: integration test for MCP stdio transport)

_Note: Resources and startMcpServer were implemented in Task 1's GREEN commit (same file, same implementation pass). Task 2's commit is the resource-specific test file._

## Files Created/Modified
- `src/mcp/server.ts` - Complete MCP server: 5 tools, 2 resources, startMcpServer(), buildFileContextText(), all handlers exported
- `tests/mcp/tools.test.ts` - 27 unit tests for all 5 tool handlers using vi.mock()
- `tests/mcp/resources.test.ts` - 12 unit tests for buildFileContextText helper and resource logic
- `tests/mcp/server.test.ts` - 2 integration tests: JSON-RPC initialize response, no non-JSON stdout

## Decisions Made
- Handler extraction pattern: each tool's logic is a named async fn exported for unit testing — McpServer registration wraps them via lambdas. This avoids coupling tests to McpServer/SDK internals.
- `CallToolResult` return type: TypeScript rejected custom `ContentResponse` interface because MCP SDK expects `{ [x: string]: unknown; content: ... }` with an index signature. Using SDK's own `CallToolResult` type satisfies this.
- `graft_summary` reads `package.json` via `fs.readFileSync` in try/catch — gracefully falls back to "No package.json detected" for repos without one.
- `graft_impact` uses `transitiveClosure` (BFS over reverse edges) not forward deps — "who breaks if I change X" is the reverse dependency chain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript overload resolution for server.tool() callbacks**
- **Found during:** Task 1 (typecheck verification)
- **Issue:** Custom `ContentResponse` interface with `readonly` array and no index signature rejected by TypeScript's MCP SDK overload resolution — SDK expects `{ [x: string]: unknown; content: ... }`
- **Fix:** Changed handler return type to `CallToolResult` imported from `@modelcontextprotocol/sdk/types.js`
- **Files modified:** `src/mcp/server.ts`
- **Verification:** `pnpm typecheck` passes with zero errors
- **Committed in:** `098396f` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type bug)
**Impact on plan:** Fix was necessary for TypeScript compilation. No scope creep — same runtime behavior, just correct type.

## Issues Encountered
- MCP SDK TypeScript types use a Zod-generated index signature on CallToolResult that custom interfaces cannot satisfy — import and use the SDK type directly rather than defining your own.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `startMcpServer()` ready for consumption by CLI `serve` command (already wired in src/cli/index.ts)
- All 5 tools and 2 resources implemented and tested
- Stdio transport integration proven via spawned binary test
- No blockers for Plan 03-03 (CLI commands) or Plan 03-04 (final integration)

## Self-Check: PASSED

- src/mcp/server.ts — FOUND
- tests/mcp/tools.test.ts — FOUND
- tests/mcp/resources.test.ts — FOUND
- tests/mcp/server.test.ts — FOUND
- Commit 0ac3bef (test: failing tool handler tests) — FOUND
- Commit 098396f (feat: implement MCP server) — FOUND
- Commit 489cc8a (test: resources tests) — FOUND
- Commit 9cefd9c (test: integration test) — FOUND
- pnpm vitest run tests/mcp: 3 test files, 39 tests passed
- pnpm typecheck: passes with zero errors

---
*Phase: 03-cli-mcp*
*Completed: 2026-03-28*
