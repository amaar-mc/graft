---
phase: 03-cli-mcp
verified: 2026-03-28T10:05:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 3: CLI + MCP Verification Report

**Phase Goal:** Developers can use all CLI commands and any MCP-compatible AI tool can call all five Graft tools and two resources to get ranked codebase context
**Verified:** 2026-03-28T10:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npx graft` with no args starts MCP server; all 5 CLI commands work with colored output and progress spinners | VERIFIED | `serve` command has `{ isDefault: true }` in Commander setup; all 4 non-serve handlers export and use `ora({ stream: process.stderr })`; CLI subprocess tests pass |
| 2 | MCP server exposes `graft_map`, `graft_context`, `graft_search`, `graft_impact`, and `graft_summary` tools — callable and returning correct responses | VERIFIED | 5 `server.tool()` registrations confirmed in `src/mcp/server.ts`; 27 unit tests for handlers pass; stdio integration test confirms JSON-RPC initialize response with `capabilities.tools` |
| 3 | `graft://map` and `graft://file/{path}` MCP resources return valid content | VERIFIED | 2 `server.resource()` registrations confirmed; `buildFileContextText` shared helper tested with 8 unit tests; resource logic tests pass |
| 4 | Total MCP tool schema serialization stays under 4,000 characters | VERIFIED | `tests/mcp/schema-size.test.ts` uses MCP Client + InMemoryTransport to measure real JSON-RPC schema; passes with schemas well under limit |
| 5 | When running as MCP server, stdout carries only JSON-RPC; all logging goes to stderr | VERIFIED | All 4 ora spinners use `{ stream: process.stderr }`; zero `console.log` in `src/cli/index.ts` or `src/mcp/server.ts`; stdout contamination subprocess tests pass |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/indexer/pipeline.ts` | Shared indexing pipeline exporting `buildIndex` | VERIFIED | 51 lines; full cache-hit/miss/stale paths; exports `buildIndex` and `IndexResult` |
| `src/mcp/server.ts` | Complete MCP server with 5 tools and 2 resources | VERIFIED | 333 lines; 5 tools + 2 resources + `startMcpServer` + `buildFileContextText` + all 5 handlers exported |
| `src/cli/index.ts` | Commander CLI with all 5 subcommands | VERIFIED | 254 lines; `serve` (isDefault), `map`, `stats`, `impact`, `search`; exports 4 handler functions |
| `tests/mcp/tools.test.ts` | Unit tests for all 5 MCP tools | VERIFIED | 27 tests covering all tool handlers with vi.mock isolation |
| `tests/mcp/resources.test.ts` | Unit tests for both MCP resources | VERIFIED | 12 tests for `buildFileContextText` and resource logic |
| `tests/mcp/server.test.ts` | Integration test for stdio transport | VERIFIED | 2 tests: JSON-RPC initialize response + stdout purity before response |
| `tests/mcp/schema-size.test.ts` | MCP-09 schema size guard | VERIFIED | Uses MCP Client + InMemoryTransport; asserts total < 4000 chars and each tool < 1500 chars |
| `tests/cli/commands.test.ts` | CLI command unit tests | VERIFIED | 24 tests for handleMap, handleStats, handleImpact, handleSearch |
| `tests/integration/stdout.test.ts` | Stdout contamination + stream separation tests | VERIFIED | Extended with 4 subprocess tests for map/stats/search/serve commands |
| `package.json` | All Phase 3 runtime dependencies | VERIFIED | `@modelcontextprotocol/sdk@1.28.0`, `zod@3.25.76`, `commander@14.0.3`, `chalk@4.1.2`, `ora@5.4.1` — all at correct CJS-compatible versions |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/indexer/pipeline.ts` | `src/indexer/discovery.ts` | `import discoverFiles` | WIRED | Line 6: `import { discoverFiles } from './discovery.js'` |
| `src/indexer/pipeline.ts` | `src/graph/index.ts` | `import buildGraph` | WIRED | Line 8: `import { buildGraph } from '../graph/index.js'` |
| `src/indexer/pipeline.ts` | `src/graph/pagerank.ts` | `import computePageRank` | WIRED | Line 9: `import { computePageRank } from '../graph/pagerank.js'` |
| `src/indexer/pipeline.ts` | `src/cache/index.ts` | `import readCache, writeCache, isCacheValid, deserializeResults` | WIRED | Line 10: all 4 cache functions imported and used in pipeline body |
| `src/mcp/server.ts` | `src/indexer/pipeline.ts` | `import buildIndex` | WIRED | Line 12: imported; called in all 5 tool handlers and both resource handlers |
| `src/mcp/server.ts` | `@modelcontextprotocol/sdk` | `import McpServer, StdioServerTransport` | WIRED | Lines 8–9: McpServer from `mcp.js`, StdioServerTransport from `stdio.js` |
| `src/mcp/server.ts` | `src/graph/traversal.ts` | `import transitiveClosure, forwardDeps, reverseDeps` | WIRED | Line 14: all 3 functions imported; used in tool handlers |
| `src/mcp/server.ts` | `src/renderer/tree.ts` | `import renderTree` | WIRED | Line 13: imported; used in `handleGraftMap` and `graft://map` resource |
| `src/cli/index.ts` | `src/mcp/server.ts` | `dynamic import startMcpServer` | WIRED | Line 198: `await import('../mcp/server.js')` inside serve action |
| `src/cli/index.ts` | `src/indexer/pipeline.ts` | `import buildIndex` | WIRED | Line 10: imported; called in all 4 command handlers |
| `src/cli/index.ts` | `src/renderer/tree.ts` | `import renderTree` | WIRED | Line 11: imported; used in `handleMap` |
| `src/cli/index.ts` | `src/graph/traversal.ts` | `import transitiveClosure` | WIRED | Line 12: imported; used in `handleImpact` |
| `src/cli/index.ts` | `src/cache/index.ts` | `import readCache` | WIRED | Line 13: imported; used in `handleStats` for cache age |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CLI-01 | 03-03 | `graft serve` command starts MCP server over stdio | SATISFIED | `serve` command in `src/cli/index.ts`; dynamically imports and calls `startMcpServer` |
| CLI-02 | 03-03 | `graft map` with optional `--focus` flag | SATISFIED | `map` command with `--focus` and `--budget` options; creates personalization map when `--focus` provided |
| CLI-03 | 03-03 | `graft stats` displays file count, definition count, edge count, cache age | SATISFIED | `handleStats` computes all 4 stats; reads cache for `createdAt` timestamp |
| CLI-04 | 03-03 | `graft impact <path>` shows affected files | SATISFIED | `impact` command with required `<path>` arg; calls `transitiveClosure` and sorts by score |
| CLI-05 | 03-03 | `graft search <query>` with optional `--kind` filter | SATISFIED | `search` command with required `<query>` and optional `--kind`; filters `graph.definitions` |
| CLI-06 | 03-01, 03-04 | Beautiful terminal output with chalk, tree chars, and ora spinners | SATISFIED | chalk used throughout; all 4 spinners use `{ stream: process.stderr }`; subprocess stream-separation tests pass |
| CLI-07 | 03-03 | Default command `npx graft` starts MCP server | SATISFIED | `serve` registered with `{ isDefault: true }` on Commander |
| MCP-01 | 03-02 | MCP server using `@modelcontextprotocol/sdk` with stdio transport | SATISFIED | `McpServer` + `StdioServerTransport` confirmed in `src/mcp/server.ts` line 8–9, 320 |
| MCP-02 | 03-02 | `graft_map` tool with optional `query` and `budget` params | SATISFIED | Registered line 240; `handleGraftMap` creates personalization map from query; default budget 2048 |
| MCP-03 | 03-02 | `graft_context` tool — subgraph for file | SATISFIED | Registered line 257; returns definitions + forward deps + reverse deps via `buildFileContextText` |
| MCP-04 | 03-02 | `graft_search` tool — structural search by name/kind | SATISFIED | Registered line 267; `handleGraftSearch` filters `graph.definitions` case-insensitively with optional kind |
| MCP-05 | 03-02 | `graft_impact` tool — transitive reverse-dependency closure | SATISFIED | Registered line 278; calls `transitiveClosure`; sorts by score descending |
| MCP-06 | 03-02 | `graft_summary` tool — project overview | SATISFIED | Registered line 288; returns file count, def count, edge count, top 10 files, tech stack from package.json |
| MCP-07 | 03-02 | `graft://map` MCP resource | SATISFIED | Static resource registered line 296; calls `buildIndex` + `renderTree` with 8192 token budget |
| MCP-08 | 03-02 | `graft://file/{path}` MCP resource | SATISFIED | Parameterized resource registered line 308 using `ResourceTemplate`; reuses `buildFileContextText` |
| MCP-09 | 03-04 | Total MCP tool schema under 4,000 characters | SATISFIED | Schema size guard test uses Client + InMemoryTransport; passes confirming all 5 schemas under 4000 chars total |

All 16 requirements (CLI-01 through CLI-07, MCP-01 through MCP-09) are SATISFIED.

### Anti-Patterns Found

No anti-patterns found.

- Zero `console.log` calls in any Phase 3 source file
- No TODO/FIXME/PLACEHOLDER comments in `src/indexer/pipeline.ts`, `src/mcp/server.ts`, or `src/cli/index.ts`
- No stub return patterns (`return null`, `return {}`, empty handlers)
- All handlers contain real implementation logic
- All spinners use `{ stream: process.stderr }` — no stdout contamination

### Human Verification Required

The following items require a live MCP client session to fully validate, but automated tests cover the protocol layer:

**1. End-to-end MCP tool invocation from Claude Code / Cursor**

- **Test:** Configure `graft serve` as an MCP server in Claude Code or Cursor, then invoke each of the 5 tools from the IDE
- **Expected:** Each tool returns formatted, readable context about the indexed codebase
- **Why human:** The stdio integration test verifies the JSON-RPC handshake but does not call individual tools through a real MCP client; only a live IDE session fully validates the user experience

**2. Visual quality of chalk output**

- **Test:** Run `graft map`, `graft stats`, `graft impact <path>`, and `graft search <query>` in a real terminal
- **Expected:** Colors render correctly; tree-drawing characters display; spinner animates during indexing
- **Why human:** Subprocess tests use `FORCE_COLOR=0` which disables ANSI in test output; visual appearance requires a TTY

### Gaps Summary

No gaps found. All 5 observable truths verified, all 10 artifacts exist and are substantive and wired, all 13 key links confirmed, all 16 requirements satisfied, full test suite (234 tests) passes, build succeeds, typecheck clean.

---

_Verified: 2026-03-28T10:05:00Z_
_Verifier: Claude (gsd-verifier)_
