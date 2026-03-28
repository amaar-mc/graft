# Roadmap: Graft

## Overview

Graft is built in four coarse phases that follow the strict pipeline dependency chain: foundation and parsing first, then graph computation and rendering, then all user-facing delivery surfaces (CLI + MCP), then quality hardening. Each phase delivers a self-contained, testable capability. The project ships when Phase 4 closes — a fully tested, production-ready codebase context engine that works out of the box via `npx graft`.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Parser** - Project scaffold, file discovery, and tree-sitter AST extraction for TS/JS and Python (completed 2026-03-28)
- [x] **Phase 2: Graph + Renderer** - Dependency graph construction, personalized PageRank, token-budgeted rendering, and cache (completed 2026-03-28)
- [ ] **Phase 3: CLI + MCP** - All user-facing surfaces: CLI commands and MCP server with tools and resources
- [ ] **Phase 4: Quality + Hardening** - Comprehensive test suite, integration tests on real repos, E2E MCP validation

## Phase Details

### Phase 1: Foundation + Parser
**Goal**: Developers can run `npx graft` in any repo and get structured symbol extraction from TypeScript/JavaScript and Python files, with all project scaffolding in place
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-04, INFRA-05, INFRA-06, PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06, QUAL-05, QUAL-06
**Success Criteria** (what must be TRUE):
  1. Running `npx graft` in any directory discovers all source files respecting .gitignore, skipping node_modules/dist/build without any config file
  2. Parser extracts `CodeNode` objects (id, name, kind, filePath, startLine, endLine, references) from TypeScript/JavaScript files including decorators, generics, enums, barrel files, and re-exports
  3. Parser extracts `CodeNode` objects from Python files including decorators, relative imports, `__init__.py` re-exports, and dataclasses
  4. Custom ignore patterns work via `.graftignore` or CLI flag
  5. TypeScript strict mode enforced (no `any`, no unsafe casts), ESLint + Prettier passing, all functions have explicit return types
**Plans**: 6 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold, toolchain, and infrastructure
- [x] 01-02-PLAN.md — File discovery with gitignore and graftignore support
- [x] 01-03-PLAN.md — Tree-sitter initialization and grammar loading
- [x] 01-04-PLAN.md — TypeScript/JavaScript and Python AST extraction
- [x] 01-05-PLAN.md — CLI wiring and integration tests
- [x] 01-06-PLAN.md — Close QUAL-06 gap: Prettier formatting + CI format:check step

### Phase 2: Graph + Renderer
**Goal**: The codebase is representable as a ranked dependency graph and renderable as a token-budgeted tree or JSON map — 100K LOC fits in ~2K tokens
**Depends on**: Phase 1
**Requirements**: GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05, GRAPH-06, REND-01, REND-02, REND-03, REND-04, REND-05, INFRA-03
**Success Criteria** (what must be TRUE):
  1. A directed dependency graph is built from parser output; files that are imported by many others score higher than entry-point files that import many others (edge direction validated)
  2. Personalized PageRank with query-boosted seed weights converges correctly; dangling nodes do not monopolize rank (no single file scores 1.0 while rest score near 0)
  3. Ranked tree output fits a configurable token budget (default 2048); highest-ranked files appear first and token count is displayed
  4. JSON output contains graph structure, scores, and metadata for programmatic consumption
  5. Cache at `.graft/cache.json` uses filesystem fingerprint (path + size + mtime hash) for invalidation; stale cache is never served silently
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — Graph types, dependency graph builder, forward/reverse queries
- [ ] 02-02-PLAN.md — Standard and personalized PageRank engine (TDD)
- [ ] 02-03-PLAN.md — Transitive closure, tree renderer, JSON renderer
- [ ] 02-04-PLAN.md — Filesystem cache with mtime+size fingerprinting

### Phase 3: CLI + MCP
**Goal**: Developers can use all CLI commands and any MCP-compatible AI tool can call all five Graft tools and two resources to get ranked codebase context
**Depends on**: Phase 2
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07, MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07, MCP-08, MCP-09
**Success Criteria** (what must be TRUE):
  1. `npx graft` with no args indexes the current directory and starts the MCP server; `graft map`, `graft serve`, `graft stats`, `graft impact <path>`, and `graft search <query>` all work with beautiful colored tree output and progress spinners
  2. MCP server exposes `graft_map`, `graft_context`, `graft_search`, `graft_impact`, and `graft_summary` tools — each callable from Claude Code, Cursor, or any MCP client and returning correct responses
  3. `graft://map` and `graft://file/{path}` MCP resources return valid content
  4. Total MCP tool schema serialization stays under 4,000 characters
  5. When running as MCP server, stdout carries only JSON-RPC; all logging goes to stderr — no stdout contamination
**Plans**: TBD

### Phase 4: Quality + Hardening
**Goal**: The codebase has >90% test coverage on core modules, passes all integration and E2E tests on real repos, and is production-ready for public release
**Depends on**: Phase 3
**Requirements**: QUAL-01, QUAL-02, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):
  1. Unit tests for parser, graph, renderer, and MCP tools achieve >90% coverage on core modules; all tests pass in CI
  2. Integration tests run against fixture codebases (TypeScript project, Python project, mixed-language project) and produce correct ranked output
  3. Snapshot tests for tree renderer output catch formatting regressions — snapshots committed and passing
  4. E2E tests spin up the MCP server, connect a client, call all five tools, and verify correct responses
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Parser | 6/6 | Complete   | 2026-03-28 |
| 2. Graph + Renderer | 4/4 | Complete   | 2026-03-28 |
| 3. CLI + MCP | 0/TBD | Not started | - |
| 4. Quality + Hardening | 0/TBD | Not started | - |
