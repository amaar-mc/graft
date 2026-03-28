# Project Research Summary

**Project:** Graft — codebase context engine
**Domain:** TypeScript CLI + MCP server / code intelligence tooling
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

Graft is a local-first codebase intelligence tool that builds a dependency graph from tree-sitter AST parsing, ranks files and symbols using personalized PageRank, and serves structured context to AI coding assistants via the Model Context Protocol. The domain is well-studied: Aider's repo-map (open source, production-validated) proves the tree-sitter + PageRank approach works at scale, and the MCP TypeScript SDK is stable at v1.28.x with 36K dependents. The recommended implementation path is a strictly layered pipeline — FileDiscovery → Parser → GraphBuilder → RankEngine → Renderer — each module exposed behind a clean typed interface, with the MCP server as a thin adapter over the core engine. Every competitor either bakes their indexing into a proprietary client (Cursor, Aider) or requires complex setup (codebase-memory-mcp). Graft's differentiator is being MCP-native, zero-config, and structurally smarter than any existing lightweight option.

The highest-risk technical pieces are the tree-sitter WASM/native binding strategy and the PageRank implementation. Tree-sitter has active version churn between the runtime and grammar packages — a version mismatch causes silent parse failures that are hard to diagnose in a packaged `npx` install. PageRank on a code graph requires correct dangling-node handling and the right edge direction convention; both are easy to get wrong and produce subtly broken rankings. The personalized PageRank (query-seeded weights) is the core differentiator and must ship in v1 — it is what separates Graft from static ranking tools.

The critical operational pitfall is stdout contamination: any non-JSON-RPC bytes written to stdout in MCP stdio mode silently destroy the session. This must be enforced via a stderr-only logger and ESLint's `no-console` rule from day one, not retrofitted later. Secondary pitfalls — auto-generated files polluting rankings, stale cache without invalidation, and MCP tool schema token bloat — each have clear prevention strategies that must be built into the correct phase. The stack choices are largely settled; the only active uncertainty is the ESM vs CJS output format decision and its downstream effect on chalk/ora versioning.

## Key Findings

### Recommended Stack

The stack is TypeScript strict, Node.js 18 LTS minimum, pnpm, tsup (CJS output recommended for `npx` compatibility), and Vitest. For parsing, use native `tree-sitter` bindings as primary with a runtime fallback to `web-tree-sitter` WASM when native fails to build — this covers both fast local installs and exotic environments. The MCP layer is `@modelcontextprotocol/sdk@1.28.x` with `zod@^3.25.0` (not v4 — active runtime incompatibility). CLI is Commander v12 (lightweight, 152M weekly downloads) with chalk@4 + ora@5 for CJS builds. File discovery is fast-glob + the `ignore` package for correct gitignore semantics.

The single most load-bearing version constraint: do not upgrade zod to v4 while on MCP SDK v1. The incompatibility is a runtime crash (`keyValidator._parse is not a function`), not a type error — it will not be caught at build time.

**Core technologies:**
- `tree-sitter` (native) + `web-tree-sitter` (WASM fallback): AST parsing — native is 3-5x faster; WASM is the universal fallback
- `@modelcontextprotocol/sdk@1.28.x`: MCP server — official Anthropic SDK, v1.x is production-stable
- `zod@^3.25.0`: MCP tool schema validation — must stay on v3 until MCP SDK v2 ships
- `commander@12.x`: CLI argument parsing — lightest option, clean TypeScript API
- `fast-glob@3.3.3` + `ignore@6.x`: file discovery — correct gitignore semantics, not a reimplementation
- `tsup@8.5.x`: build — wraps esbuild, zero-config, emits CJS+ESM+types
- `vitest@4.x`: testing — native ESM + TypeScript, snapshot support built-in

### Expected Features

The feature dependency chain is strict: file discovery feeds AST parsing, which feeds graph construction, which feeds PageRank, which feeds rendering, which feeds MCP tools. Nothing downstream of any step can be built without the step before it. This directly dictates build order.

**Must have (table stakes) — users expect these from any serious tool in this space:**
- AST-based symbol extraction via tree-sitter (functions, classes, methods, types)
- Dependency graph construction (file nodes, import-reference edges)
- Token-budget-aware context rendering within configurable ceiling
- .gitignore-aware file discovery (also skip node_modules, dist, build by default)
- Symbol search by name and kind
- Structural project overview (entry points, stack detection)
- Ranked output (PageRank-based, not alphabetical)
- MCP tool and resource exposure
- Zero-config startup via `npx graft`
- In-repo cache (`.graft/cache.json`) for fast restarts

**Should have (competitive differentiators):**
- Personalized PageRank with query-boosted seed weights — the core IP; no lightweight competitor has this
- `graft_impact` transitive reverse-dependency closure — "what breaks if I change X?" — unique in the lightweight MCP space
- Dual output format: tree (human-readable) + JSON (programmatic agent consumption)
- `graft_context` 1-hop subgraph for a file or symbol — immediate utility for editing sessions
- Tool-agnostic MCP-native delivery — works with Claude Code, Cursor, Zed, Aider equally
- Beautiful CLI output — box-drawing trees, colors, spinners — DX matters

**Defer to v1.x / v2+:**
- File watcher / incremental re-indexing — requires daemon model, conflicts with stateless MCP call model
- Additional languages beyond TS/JS + Python — add on user demand
- Semantic vector/embedding search — violates local-first constraint; structural search covers 90% of agent use cases
- Dead code detection — requires whole-program type resolution, out of scope
- Multi-repo federation — enterprise feature, adds auth/infra complexity

### Architecture Approach

The architecture is a strict 7-component linear pipeline, each component isolated behind a typed interface. The core seam is the `Tag` type (`{ file, name, kind, line }`) — every language parser outputs Tags and everything downstream operates exclusively on Tags, never on raw AST nodes. This makes caching, language extension, and unit testing all tractable. The MCP server sits at the top as a thin adapter: it holds no business logic, calls Indexer/RankEngine/Renderer, and formats results as MCP responses. Build order is determined by the dependency chain — Parser before GraphBuilder before RankEngine before Renderer before Indexer before CLI before MCP Server.

**Major components:**
1. **FileDiscovery** — recursive glob with gitignore filtering; returns file path list; no parsing
2. **Parser** — tree-sitter extraction per language; input: file path; output: `Tag[]`; knows nothing about graphs
3. **GraphBuilder** — `Tag[]` → directed adjacency map (importer → importee edges, weighted by ref count)
4. **RankEngine** — iterative personalized PageRank over the graph; accepts optional query bias; pure function
5. **Renderer** — ranked file+symbol list → token-budgeted tree string or JSON; no I/O
6. **Indexer** — orchestrates FileDiscovery → Parser → GraphBuilder; owns cache read/write; single entry point
7. **MCP Server** — thin adapters over Indexer + RankEngine + Renderer; stdio transport; no business logic

### Critical Pitfalls

1. **stdout contamination kills MCP sessions silently** — any `console.log()` to stdout corrupts the JSON-RPC channel; MCP client reports opaque parse errors. Set up `logger.ts` (stderr-only) in Phase 1 before writing any output code, enforce with `no-console` ESLint rule in `src/mcp/`.

2. **Tree-sitter WASM/grammar version mismatch breaks install-time** — runtime and grammar `.wasm` files must be version-locked together; path resolution in bundled `npx` output requires an explicit `locateFile` callback. Pin versions as a set, vendor pre-built WASM files in `src/assets/`, add a CI test that runs `npm pack + npx` end-to-end in Phase 1.

3. **Dangling nodes produce degenerate PageRank (one file scores 1.0, rest near 0)** — sink nodes (files with no outgoing imports) absorb all rank flow. Implement dangling-node correction (redistribute sink rank uniformly) in Phase 2 before any ranking output is trusted.

4. **Wrong graph edge direction inverts ranking** — "importer → importee" is the correct convention for PageRank (importee authority = inbound links). Getting this backwards surfaces entry-point files as most important. Lock the convention with a deterministic unit test (utility imported by 10 files must outrank main.ts that imports 10 files) before wiring into the renderer.

5. **Stale cache serves wrong context with no user signal** — v1 defers file watching, but cache without invalidation is worse than no cache. Use a filesystem fingerprint hash (sorted `{path, size, mtime}` tuples) as the cache key, not just startup timestamp. Must ship with the cache in the same phase.

## Implications for Roadmap

Based on the strict feature dependency chain and the pitfall-to-phase mapping from research, a 7-phase structure is recommended. Phases 1-3 build the core engine; Phase 4 adds the CLI surface; Phase 5 adds MCP delivery; Phases 6-7 address hardening and extensibility.

### Phase 1: Project Foundation + Parser
**Rationale:** Parser is the riskiest technical piece and has no dependencies on other Graft modules. The WASM/native binding strategy, grammar version pinning, locateFile path resolution, and tsx/ts grammar separation must all be validated before any downstream code is written. The logger utility (stderr-only) must also be created here to prevent stdout contamination from the first line of output code.
**Delivers:** Working tree-sitter parser for TypeScript/JavaScript/Python; `Tag[]` output contract; logger utility; file discovery with gitignore filtering; WASM grammar loading with path resolution; CI smoke test via `npm pack + npx`
**Addresses:** table stakes — AST symbol extraction, .gitignore-aware file discovery, zero-config startup foundation
**Avoids:** WASM version lock-in pitfall, tsx/ts grammar mismatch, stdout contamination

### Phase 2: Graph Construction + Ranking
**Rationale:** GraphBuilder and RankEngine are pure functions with no I/O — the easiest components to unit test in isolation. PageRank correctness (edge direction, dangling-node handling, convergence) must be validated with deterministic fixtures before any rendering or MCP code consumes rank scores. Auto-generated file exclusion (barrel files, `*.d.ts`, generated directories) must be implemented here where the graph is built, not later in the renderer.
**Delivers:** Directed dependency graph from Tag[]; personalized PageRank with query-seeded weights; dangling-node correction; barrel file ranking penalty; validated edge direction convention
**Addresses:** dependency graph construction, ranked output, personalized PageRank (core differentiator)
**Avoids:** dangling-node degenerate ranking, wrong edge direction, auto-generated file poisoning

### Phase 3: Renderer + Cache
**Rationale:** Renderer depends on ranked data (Phase 2 output) and nothing else — no I/O, fully snapshot-testable. Token budget math must be calibrated here (3 chars/token for mixed code/text; 2.5 for JSON mode) before snapshot baselines are set. Cache must ship in this phase alongside the Indexer wiring, with filesystem fingerprint invalidation included — not deferred.
**Delivers:** Token-budgeted tree output; token-budgeted JSON output; `Indexer` orchestrator wiring FileDiscovery → Parser → GraphBuilder; `.graft/cache.json` with fingerprint-based invalidation; `graft stats` output showing cache age and file counts
**Addresses:** token-budget-aware rendering, dual output format, in-repo cache
**Avoids:** stale cache without invalidation, token budget over-estimation for code (wrong char/token ratio)

### Phase 4: CLI Commands
**Rationale:** With the full pipeline working (Phases 1-3), CLI commands are thin wiring + output formatting. This is also when `graft_impact` (reverse-dependency BFS) and `graft_context` (1-hop subgraph) are implemented in the graph layer and exposed as CLI commands. Beautiful output (chalk, ora spinners, box-drawing trees) ships here.
**Delivers:** `graft map`, `graft serve`, `graft stats`, `graft impact`, `graft search` CLI commands; chalk + ora output; progress indicators; reverse-dependency BFS for impact analysis; 1-hop subgraph for context
**Addresses:** CLI usability, beautiful DX, `graft_impact` differentiator, `graft_context` subgraph
**Avoids:** synchronous startup (blocking UX on large repos)

### Phase 5: MCP Server
**Rationale:** MCP server is the delivery mechanism for all prior work. It is explicitly last in the build order because tool handlers are thin adapters — they add no logic, only protocol wiring. Schema token bloat must be addressed here (target < 4,000 chars total across all tools). Stdio safety must be verified before release.
**Delivers:** `graft_map`, `graft_context`, `graft_search`, `graft_impact`, `graft_summary` MCP tools; `graft://map` and `graft://file/{path}` MCP resources; stdio transport; schema size assertion test; path traversal protection for file resources
**Addresses:** MCP-native delivery, all MCP tool table stakes, zero-config `npx graft serve`
**Avoids:** MCP tool schema token bloat, stdout contamination in server code, path traversal in file resource

### Phase 6: Hardening + Integration Testing
**Rationale:** End-to-end validation on real repos (not fixtures) is required before public release. This phase catches the class of bugs that only appear at scale — WASM memory, PageRank on large sparse graphs, cache performance on 100K+ LOC repos. MCP inspector integration is used here for full protocol validation.
**Delivers:** End-to-end tests on representative real repos; performance benchmarks (cold/warm start targets: <30s cold, <2s warm for 100K LOC); `@modelcontextprotocol/inspector` integration; `npm pack + npx` CI test; "looks done but isn't" checklist verification
**Addresses:** production readiness, performance targets, MCP protocol correctness
**Avoids:** performance traps (per-file WASM instantiation, synchronous file walk, full AST in graph nodes)

### Phase 7: Language Extension Interface
**Rationale:** TS/JS + Python covers v1. The language registry pattern (extension → grammar → extractor) must be clean enough for community contributions. This phase formalizes the interface, adds Go as the first third-party language to validate the extension model, and documents the grammar registration process.
**Delivers:** Clean language registry interface; `loader.ts` extension mapping; Go grammar as validation; documented grammar-registration guide for contributors
**Addresses:** additional languages (v1.x scope), clean architecture for extensibility
**Avoids:** monolithic parser with language-specific branches (anti-pattern 3 from ARCHITECTURE.md)

### Phase Ordering Rationale

The ordering follows the strict feature dependency chain documented in FEATURES.md: file discovery → parsing → graph → ranking → rendering → CLI → MCP. No phase can be meaningfully tested until its dependencies are complete. Specifically: the MCP server is last because its tools call into all prior components — testing the server with mocked internals validates only the protocol glue, not the product. Parser-first is critical because tree-sitter WASM initialization is the highest-variance integration point; discovering WASM path resolution failures in Phase 1 instead of Phase 5 is a significant risk reduction.

Cache and renderer are grouped in Phase 3 (rather than splitting them) because the cache invalidation strategy is coupled to the parse pipeline — if cache is written in Phase 3 but invalidation is designed in Phase 4, you ship v1 with the stale-cache bug (recovery cost: HIGH per pitfalls research).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Parser):** Tree-sitter WASM loading in bundled `npx` context has known complexity (locateFile path resolution, grammar WASM shipping strategy). The native vs WASM fallback decision needs a concrete implementation spike before architecture is finalized.
- **Phase 5 (MCP Server):** MCP client behavior on server reconnect and keep-alive semantics are not fully specified in MCP 1.x docs. The `graft serve` keep-alive loop behavior when a client disconnects needs verification against Claude Code and Cursor behaviors.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Graph + Ranking):** Personalized PageRank is a well-documented algorithm. The implementation is a direct translation of the standard power-iteration method with seeded personalization vectors.
- **Phase 3 (Renderer + Cache):** Token-budgeted rendering via binary search is a standard greedy algorithm. The cache is straightforward JSON serialization with a hash-based dirty check.
- **Phase 4 (CLI):** Commander + chalk + ora are stable, well-documented libraries with no novel integration challenges.
- **Phase 6 (Hardening):** Standard integration test patterns; no new technology introduced.
- **Phase 7 (Language Extension):** The extension interface follows established patterns from the parser architecture already designed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core framework choices HIGH; tree-sitter binding strategy MEDIUM due to active version churn in WASM/native alignment. Zod/MCP version constraint HIGH (active open issue confirmed). |
| Features | HIGH | Competitive analysis from 8+ tools; Aider's open-source implementation provides a validated production reference. Feature dependency chain is deterministic. |
| Architecture | HIGH | Validated against Aider's production architecture; MCP SDK official docs; tree-sitter official code navigation docs. Component boundaries are well-understood. |
| Pitfalls | HIGH | Critical pitfalls verified via official GitHub issues, production post-mortems, and MCP community reports. Recovery costs quantified. |

**Overall confidence:** HIGH

### Gaps to Address

- **CJS vs ESM output format decision:** The choice of tsup output format (CJS recommended for `npx` compatibility vs ESM for chalk@5/ora@8) needs to be locked before Phase 4 CLI work begins. ESM output may cause issues with some MCP client environments — needs verification.
- **Native tree-sitter prebuild availability:** The native `tree-sitter` N-API bindings ship prebuilt for Node 18/20/22 on x64/arm64, but the exact list of prebuilt platforms needs verification for the `npx graft` install target. If prebuilds are missing for a platform, the WASM fallback path must be exercised — confirm it works end-to-end before Phase 1 closes.
- **MCP client keep-alive behavior:** `graft serve` keep-alive semantics when the MCP client disconnects and reconnects are not fully specified. This needs a live test against Claude Code before Phase 5 ships.
- **Token budget calibration for code:** The 3 chars/token approximation for mixed code output (vs 4 chars for prose) is a conservative heuristic. Calibrate against real repo outputs with tiktoken in Phase 3 to set accurate snapshot baselines.

## Sources

### Primary (HIGH confidence)
- [Aider repo-map architecture](https://aider.chat/2023/10/22/repomap.html) — production-validated tree-sitter + PageRank approach
- [tree-sitter code navigation / tags.scm](https://tree-sitter.github.io/tree-sitter/4-code-navigation.html) — official tag extraction API
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — v1.28.0, 36K dependents, v1.x production-stable
- [MCP TypeScript SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) — tool/resource registration, stdio transport
- [MCP SDK zod compatibility issue #906](https://github.com/modelcontextprotocol/typescript-sdk/issues/906) — zod v3 vs v4 runtime crash confirmed
- [web-tree-sitter npm](https://www.npmjs.com/package/web-tree-sitter) — version, WASM binding details
- [tree-sitter/node-tree-sitter GitHub](https://github.com/tree-sitter/node-tree-sitter) — v0.22.4 native bindings, prebuildify approach

### Secondary (MEDIUM confidence)
- [Aider deepwiki architecture analysis](https://deepwiki.com/Aider-AI/aider/4.1-repository-mapping-system) — third-party analysis consistent with official source
- [Sourcegraph ranking-in-a-week](https://sourcegraph.com/blog/ranking-in-a-week) — directed vs undirected edge decision in production code graph
- [MCP Tool Schema Bloat — Layered.dev](https://layered.dev/mcp-tool-schema-bloat-the-hidden-token-tax-and-how-to-fix-it/) — 54,600-token schema overhead measurement
- [Modern Tree-sitter part 7 — Pulsar blog](https://blog.pulsar-edit.dev/posts/20240902-savetheclocktower-modern-tree-sitter-part-7/) — WASM vs native performance, pain points
- [commander vs yargs comparison — pkgpulse](https://www.pkgpulse.com/compare/commander-vs-yargs) — download counts, health scores

### Tertiary (LOW confidence)
- [MCP server executables — dev.to](https://dev.to/leomarsh/mcp-server-executables-explained-npx-uvx-docker-and-beyond-1i1n) — npx/stdio MCP patterns, needs live verification
- [LLM token counts practical guide — Winder.ai](https://winder.ai/calculating-token-counts-llm-context-windows-practical-guide/) — code tokenizes at different ratios than prose (basis for 3 chars/token recommendation)

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*
