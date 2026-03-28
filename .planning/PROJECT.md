# Graft

## What This Is

Graft is an open source, local-first codebase context engine that parses TypeScript/JavaScript and Python codebases into a ranked dependency graph using tree-sitter and personalized PageRank, then serves that context to AI coding tools via MCP. Run `npx graft` in any repo and every MCP-compatible AI tool gets deep structural and semantic understanding in ~2K tokens — zero config, zero cloud, nothing leaves the machine.

## Core Value

Any developer can run `npx graft serve` in their project and immediately give their AI coding tool accurate, ranked, token-efficient understanding of their entire codebase — without any code leaving their machine.

## Requirements

### Validated

- ✓ Parse TypeScript/JavaScript and Python codebases into structured ASTs using tree-sitter — v1.0
- ✓ Extract definitions (functions, classes, methods, interfaces, types) and references (usages) from source files — v1.0
- ✓ Build a directed dependency graph from parser output (files as nodes, references as edges) — v1.0
- ✓ Implement personalized PageRank to rank files by relevance to a given query/context — v1.0
- ✓ Render ranked code maps in tree format within a configurable token budget — v1.0
- ✓ Render maps in JSON format for programmatic consumption — v1.0
- ✓ Expose `graft_map` MCP tool — v1.0
- ✓ Expose `graft_context` MCP tool — v1.0
- ✓ Expose `graft_search` MCP tool — v1.0
- ✓ Expose `graft_impact` MCP tool — v1.0
- ✓ Expose `graft_summary` MCP tool — v1.0
- ✓ Expose MCP resources: `graft://map` and `graft://file/{path}` — v1.0
- ✓ CLI commands: `graft map`, `graft serve`, `graft stats`, `graft impact`, `graft search` — v1.0
- ✓ .gitignore-aware file discovery with sensible defaults — v1.0
- ✓ Zero-config experience — works out of the box in any repo — v1.0
- ✓ 100K LOC codebase representable in ~2K tokens of ranked context — v1.0
- ✓ Beautiful CLI output with colors, tree-drawing characters, progress spinners — v1.0
- ✓ Comprehensive test suite (unit, integration, snapshot, E2E) targeting >90% coverage on core modules — v1.0

### Active

- [ ] Go language support (definitions + references extraction)
- [ ] Rust language support (definitions + references extraction)
- [ ] File system watcher for real-time incremental re-indexing
- [ ] README.md with hero section, animated terminal GIF, quick start, MCP integration guides
- [ ] npm publish configuration with `npx graft` zero-install experience
- [ ] Performance benchmarks on real-world repos (Next.js, Express, FastAPI)

### Out of Scope

- External database dependencies — graph lives in memory, serialize to `.graft/cache.json`
- GUI or web interface — CLI and MCP server only
- Cloud/telemetry features — local-first is a hard constraint
- Semantic vector embeddings — structural graph search covers 90% of agent use cases
- Cypher/GraphQL query language — 5 MCP tools cover the access patterns AI agents need

## Context

**Shipped v1.0 MVP** on 2026-03-28 with 8,141 LOC TypeScript across 134 files.
**Tech stack:** TypeScript strict, Node 18+, pnpm, tree-sitter (native with WASM fallback), Vitest, tsup (CJS output).
**Runtime deps:** @modelcontextprotocol/sdk, zod@3, chalk@4, ora@5, commander@14, tree-sitter, fast-glob, ignore.

**Market positioning:** No standalone, tool-agnostic codebase context engine exists in the MCP ecosystem. Aider has repo-map baked in, Cursor has proprietary indexing — Graft fills this gap as an open, composable tool.

**tree-sitter approach:** Native tree-sitter as primary, WASM fallback for portability. Validated during Phase 1 — native works on all major platforms, WASM covers edge cases.

**npm package name:** `graft` availability needs verification before publish.

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
| Native tree-sitter (primary), WASM fallback | Portability with speed where available | ✓ Good — native works on all platforms, WASM covers edge cases |
| In-memory graph, no external DB | Simplicity, zero dependencies; 500K files fits in memory | ✓ Good — cache.json handles persistence |
| ~3 chars/token approximation | Avoid tiktoken dependency; rough accuracy sufficient | ✓ Good — budget enforcement works correctly |
| PageRank with damping 0.85, delta < 1e-6 | Standard IR approach; personalization via query-boosted weights | ✓ Good — dangling-node teleport redistribution solved rank sinks |
| TS/JS + Python for v1 languages | Most common AI-assisted languages; prove concept before expanding | ✓ Good — covers majority of use cases |
| Phases 1-4 = v1 ship target | Full value prop (parse → graph → render → MCP → quality) | ✓ Good — shipped in 2 days |
| CJS output via tsup | `npx` compatibility — ESM chalk/ora not worth the install friction | ✓ Good — chalk@4, ora@5 pinned to CJS-compatible versions |
| Zod pinned to v3.x | v4 crashes MCP SDK v1 at runtime | ✓ Good — no build-time signal, runtime crash avoided |
| stderr-only logger | stdout contamination kills MCP sessions silently | ✓ Good — enforced by ESLint no-console rule |
| MIT license | Maximum adoption for open source dev tooling | — Pending (not yet published) |

---
*Last updated: 2026-03-28 after v1.0 milestone*
