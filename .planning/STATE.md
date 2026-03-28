---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 04-quality-hardening/04-03-PLAN.md
last_updated: "2026-03-28T18:15:14.149Z"
last_activity: 2026-03-27 — Roadmap created, all 45 v1 requirements mapped to 4 phases
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 17
  completed_plans: 17
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** Any developer can run `npx graft serve` and immediately give their AI coding tool accurate, ranked, token-efficient understanding of their entire codebase — without any code leaving their machine.
**Current focus:** Phase 1 — Foundation + Parser

## Current Position

Phase: 1 of 4 (Foundation + Parser)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-27 — Roadmap created, all 45 v1 requirements mapped to 4 phases

Progress: [██░░░░░░░░] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-foundation-parser P01 | 6 | 3 tasks | 19 files |
| Phase 01-foundation-parser P02 | 2 | 1 tasks | 2 files |
| Phase 01-foundation-parser P03 | 5 | 4 tasks | 4 files |
| Phase 01-foundation-parser P05 | 2 | 1 tasks | 1 files |
| Phase 01-foundation-parser P04 | 5 | 3 tasks | 5 files |
| Phase 01-foundation-parser P06 | 1 | 3 tasks | 5 files |
| Phase 02-graph-renderer P02 | 3 | 2 tasks | 4 files |
| Phase 02-graph-renderer P01 | 4 | 2 tasks | 5 files |
| Phase 02-graph-renderer P04 | 2 | 1 tasks | 3 files |
| Phase 02-graph-renderer P03 | 4 | 2 tasks | 7 files |
| Phase 03-cli-mcp P01 | 8 | 3 tasks | 4 files |
| Phase 03-cli-mcp PP03 | 526025min | 1 tasks | 2 files |
| Phase 03-cli-mcp P02 | 6 | 3 tasks | 4 files |
| Phase 03-cli-mcp P04 | 3 | 2 tasks | 2 files |
| Phase 04-quality-hardening P01 | 2 | 2 tasks | 13 files |
| Phase 04-quality-hardening PP02 | 8 | 2 tasks | 6 files |
| Phase 04-quality-hardening P03 | 24 | 2 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Native tree-sitter as primary, WASM fallback — portability with speed where available
- [Init]: CJS output (tsup) for `npx` compatibility — ESM chalk/ora not worth the install friction
- [Init]: Zod must stay on v3.x — v4 crashes MCP SDK v1 at runtime (no build-time signal)
- [Init]: stderr-only logger must be created in Phase 1 before any output code — stdout contamination kills MCP sessions silently
- [Phase 01-foundation-parser]: TypeScript pinned to 5.9.3 — TS 6.0.2 incompatible with @typescript-eslint 8.x (<6.0.0 required); jiti installed as dev dep for ESLint 10 .ts config loading
- [Phase 01-foundation-parser]: tsup outExtension forces .cjs extension; package.json types points to dist/index.d.ts (tsup dts plugin produces .d.ts not .d.cts)
- [Phase 01-foundation-parser]: fast-glob enumerate + ignore filter separation: fast-glob handles dirs at glob level for perf, ignore instance handles negation for correctness
- [Phase 01-foundation-parser]: Default dirs applied at both glob level and ignore instance level — defense-in-depth ensures gitignore negation still works
- [Phase 01-foundation-parser]: Two-phase extraction (tags.scm + AST walk): TypeScript tags.scm only covers function_signature/method_signature — AST walk handles function_declaration, class_declaration, type_alias_declaration, enum_declaration
- [Phase 01-foundation-parser]: Empty Query fallback in createTagQuery(): tags.scm compilation failures degrade gracefully to pure AST walk without crashing
- [Phase 01-foundation-parser]: Python __init__.py relative imports emit as 'export' kind to model barrel file semantics in the dependency graph
- [Phase 01-foundation-parser]: stderr-only output enforced at CLI layer — stdout contamination would break future MCP sessions
- [Phase 01-foundation-parser]: Minimal Phase 1 CLI: no commander/colors/spinners — proves pipeline works; polish deferred to Phase 3
- [Phase 01-foundation-parser]: Python methods emit 'method' kind via upsertNode override with insideClass tracking — tags.scm Python grammar has no definition.method, AST walk must override Phase 1 results
- [Phase 01-foundation-parser]: import_from_statement uses module_name field text directly for module path — relative_import node already contains complete path string
- [Phase 01-foundation-parser]: Python imported names collected via dotted_name namedChildren (not identifier type) — matches actual tree-sitter Python grammar structure
- [Phase 01-foundation-parser]: Format:check wired into CI after Lint, before Test — early fail on cheap checks before expensive test runs
- [Phase 02-graph-renderer]: Dangling-node rank redistributed via teleport vector — prevents rank sinks and keeps scores summing to 1.0
- [Phase 02-graph-renderer]: buildTeleportVector normalizes caller weights internally; falls back to uniform for zero or unknown seeds
- [Phase 02-graph-renderer]: FileGraph uses ReadonlySet/ReadonlyMap for immutable public surface — mutable Map<string, Set<string>> internally, cast at return boundary
- [Phase 02-graph-renderer]: resolveImportPath silently drops non-relative refs (npm packages, builtins) — no error, no edge
- [Phase 02-graph-renderer]: forwardDeps/reverseDeps are thin wrappers establishing the named public API contract for Phase 3 CLI/MCP
- [Phase 02-graph-renderer]: mtime+size fingerprint chosen over content hash — O(1) stat vs O(n) read; no new runtime deps; relative paths in cache for cross-machine portability
- [Phase 02-graph-renderer]: transitiveClosure always includes seed file itself — callers never need special-case unknown handling
- [Phase 02-graph-renderer]: Budget enforcement breaks at first overflow block — partial blocks never emitted, output is always coherent
- [Phase 02-graph-renderer]: tokenCount in JSON computed from preliminary serialization — approximation avoids circular dependency
- [Phase 03-cli-mcp]: chalk pinned to v4.x (not v5+): v5+ is ESM-only, breaks CJS bundle
- [Phase 03-cli-mcp]: ora pinned to v5.x (not v6+): v6+ is ESM-only, breaks CJS bundle
- [Phase 03-cli-mcp]: buildIndex returns all four fields (graph, scores, files, results): downstream consumers need full access to each stage output
- [Phase 03-cli-mcp]: require() for package.json version: resolves correctly in both Vitest test context (src/cli/) and CJS dist output (dist/)
- [Phase 03-cli-mcp]: Dynamic import of startMcpServer in serve action: defers MCP SDK loading to serve-only code path
- [Phase 03-cli-mcp]: Handler extraction for testability: each tool logic extracted to named async fn exported for unit testing — McpServer registration wraps them
- [Phase 03-cli-mcp]: CallToolResult return type: handlers return SDK's CallToolResult type not custom interface — required for TypeScript overload resolution with server.tool()
- [Phase 03-cli-mcp]: MCP Client + InMemoryTransport used for schema size test: gives exact JSON Schema MCP clients see
- [Phase 03-cli-mcp]: child_process.spawn for CLI subprocess tests: byte-accurate stream separation, FORCE_COLOR=0 to suppress ANSI
- [Phase 04-quality-hardening]: createGraftServer returns McpServer without transport — Option B from research; zero production API change
- [Phase 04-quality-hardening]: Mixed-project fixture uses two separate clusters (TS + Python) to assert no cross-language edges per research pitfall 5
- [Phase 04-quality-hardening]: buildGraph reads node.name (not node.references) for import/export module paths — all parsers consistently store module path in name field
- [Phase 04-quality-hardening]: Snapshot budget=20 tokens (charBudget=60) demonstrates truncation with fileA included but fileB excluded
- [Phase 04-quality-hardening]: E2E MCP coverage: fixture package.json with only dependencies covers devDependencies ?? {} null branch in handleGraftSummary
- [Phase 04-quality-hardening]: EISDIR trick used to trigger non-ENOENT cache read error — more portable than chmod for cross-platform testing
- [Phase 04-quality-hardening]: Coverage gap tests require fixtures targeting specific grammar branches (namespace_import.ts, decorator_calls.py, advanced_imports.py)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: WASM grammar version pinning and `locateFile` path resolution in bundled `npx` context is the highest-variance integration point — needs spike before architecture is finalized
- [Phase 3]: MCP client keep-alive semantics on disconnect/reconnect not fully specified — needs live test against Claude Code before Phase 3 ships

## Session Continuity

Last session: 2026-03-28T18:15:14.146Z
Stopped at: Completed 04-quality-hardening/04-03-PLAN.md
Resume file: None
