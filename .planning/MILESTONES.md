# Milestones

## v1.0 MVP (Shipped: 2026-03-28)

**Phases:** 4 | **Plans:** 17 | **Requirements:** 45/45
**Commits:** 84 (22 feat) | **LOC:** 8,141 TypeScript | **Files:** 134
**Timeline:** 2 days (2026-03-27 → 2026-03-28)
**Git range:** `0b4cb80..9479e70`

**Delivered:** A local-first codebase context engine that parses TS/JS and Python into a ranked dependency graph and serves it to AI coding tools via MCP — zero-config, zero cloud, works with `npx graft`.

**Key accomplishments:**
1. Tree-sitter AST extraction for TypeScript/JavaScript and Python with structured CodeNode output (decorators, generics, barrel files, relative imports, dataclasses)
2. Directed dependency graph with personalized PageRank — 100K LOC representable in ~2K tokens
3. MCP server with 5 tools (`graft_map`, `graft_context`, `graft_search`, `graft_impact`, `graft_summary`) and 2 resources
4. CLI with 5 subcommands (`map`, `serve`, `stats`, `impact`, `search`), colored tree output, and progress spinners
5. Comprehensive test suite — integration fixtures, snapshot tests, E2E MCP validation, >90% core module coverage
6. Zero-config local-first experience — `npx graft` works in any repo with no setup

**Phases:**
- Phase 1: Foundation + Parser (6 plans) — completed 2026-03-28
- Phase 2: Graph + Renderer (4 plans) — completed 2026-03-28
- Phase 3: CLI + MCP (4 plans) — completed 2026-03-28
- Phase 4: Quality + Hardening (3 plans) — completed 2026-03-28

---

