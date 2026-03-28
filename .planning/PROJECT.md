# Graft

## What This Is

Graft is an open source, local-first codebase context engine that parses any codebase into an intelligent, ranked, graph-based map and serves it to AI coding tools via MCP (Model Context Protocol). It targets AI power users — developers already using Claude Code, Cursor, Aider, or similar tools — who are frustrated that their AI assistants don't understand their codebase. Run `npx graft` in any repo, and every MCP-compatible AI tool gets deep structural and semantic context in minimal tokens.

## Core Value

Any developer can run `npx graft serve` in their project and immediately give their AI coding tool accurate, ranked, token-efficient understanding of their entire codebase — without any code leaving their machine.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Parse TypeScript/JavaScript and Python codebases into structured ASTs using tree-sitter
- [ ] Extract definitions (functions, classes, methods, interfaces, types) and references (usages) from source files
- [ ] Build a directed dependency graph from parser output (files as nodes, references as edges)
- [ ] Implement personalized PageRank to rank files by relevance to a given query/context
- [ ] Render ranked code maps in tree format (hierarchical directory + definitions) within a configurable token budget
- [ ] Render maps in JSON format for programmatic consumption
- [ ] Expose `graft_map` MCP tool — ranked tree map with optional query personalization and token budget
- [ ] Expose `graft_context` MCP tool — relevant subgraph for a file or symbol
- [ ] Expose `graft_search` MCP tool — structural search by name, kind, or pattern
- [ ] Expose `graft_impact` MCP tool — transitive reverse dependency closure for change impact analysis
- [ ] Expose `graft_summary` MCP tool — project overview with modules, entry points, tech stack detection
- [ ] Expose MCP resources: `graft://map` and `graft://file/{path}`
- [ ] CLI commands: `graft map`, `graft serve`, `graft stats`, `graft impact`, `graft search`
- [ ] .gitignore-aware file discovery with sensible defaults (skip node_modules, vendor, dist, build)
- [ ] Zero-config experience — works out of the box in any repo
- [ ] 100K LOC codebase representable in ~2K tokens of ranked context
- [ ] Beautiful CLI output with colors, tree-drawing characters, progress spinners
- [ ] Comprehensive test suite (unit, integration, snapshot, E2E) targeting >90% coverage on core modules

### Out of Scope

- File watcher / real-time incremental re-indexing — deferred to post-v1 (Phase 6)
- Languages beyond TypeScript/JavaScript and Python — add incrementally post-v1
- README.md, CONTRIBUTING.md, npm publish polish — deferred to post-v1 (Phase 7)
- External database dependencies — graph lives in memory, serialize to `.graft/cache.json`
- GUI or web interface — CLI and MCP server only
- Cloud/telemetry features — local-first is a hard constraint

## Context

**Market positioning:** No standalone, tool-agnostic codebase context engine exists in the MCP ecosystem. Aider has repo-map baked in, Cursor has proprietary indexing — but nothing serves this as an open, composable tool that works with any MCP client. Graft fills this gap AND does it better than the baked-in approaches.

**Developer pain:** 63% of developers say AI tools lack codebase context (Stack Overflow 2025). 66% spend time fixing "almost right" AI code. This is the #1 frustration with AI coding assistants.

**tree-sitter approach:** The spec calls for WASM bindings for portability with native fallback for speed. This is a best guess — research should validate the right binding strategy before implementation.

**npm package name:** `graft` may or may not be available on npm. Backup names exist if needed. Verify before Phase 7 publish.

## Constraints

- **Tech stack**: TypeScript strict mode, Node 18+, pnpm, Vitest, tsup — specified and non-negotiable
- **Local-first**: Zero telemetry, zero cloud dependencies, no code leaves the machine
- **Zero-config**: Must work with `npx graft` in any repo — no config files required
- **Token efficiency**: 100K LOC → ~2K tokens of ranked context (4 chars ≈ 1 token approximation)
- **Minimal dependencies**: Keep install fast and binary small — only essential runtime deps
- **Code quality**: No `any`, no `as` casts without justification, ESLint + Prettier enforced, all functions have explicit return types

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WASM tree-sitter bindings (primary) | Portability across platforms without native compilation | — Pending (needs research validation) |
| In-memory graph, no external DB | Simplicity, zero dependencies; 500K files fits in memory | — Pending |
| 4 chars ≈ 1 token approximation | Avoid tiktoken dependency; 10% accuracy is sufficient | — Pending |
| PageRank with damping 0.85, delta < 1e-6 | Standard IR approach; personalization via query-boosted weights | — Pending |
| TS/JS + Python for v1 languages | Most common AI-assisted languages; prove concept before expanding | — Pending |
| Phases 1-5 = v1 ship target | Full value prop (parse → graph → render → MCP) without watcher/polish | — Pending |
| MIT license | Maximum adoption for open source dev tooling | — Pending |

---
*Last updated: 2026-03-27 after initialization*
