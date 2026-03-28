# Requirements: Graft

**Defined:** 2026-03-27
**Core Value:** Any developer can run `npx graft serve` and immediately give their AI coding tool accurate, ranked, token-efficient understanding of their entire codebase — without any code leaving their machine.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Parsing

- [x] **PARSE-01**: Extract definitions (functions, classes, methods, interfaces, types, exports) from TypeScript/JavaScript files using tree-sitter AST parsing
- [x] **PARSE-02**: Extract references (import statements, symbol usages) from TypeScript/JavaScript files to identify cross-file dependencies
- [x] **PARSE-03**: Extract definitions and references from Python files using tree-sitter AST parsing
- [x] **PARSE-04**: Handle TypeScript-specific constructs: decorators, generics, type aliases, enums, namespaces, re-exports, barrel files
- [x] **PARSE-05**: Handle Python-specific constructs: decorators, relative imports, `__init__.py` re-exports, dataclasses
- [x] **PARSE-06**: Return structured `CodeNode` objects with id, name, kind, filePath, startLine, endLine, and references

### Graph

- [ ] **GRAPH-01**: Build a directed dependency graph from parser output with files as nodes and import references as weighted edges
- [ ] **GRAPH-02**: Implement PageRank with power iteration (damping 0.85, convergence delta < 1e-6, max 100 iterations) to rank files by structural importance
- [ ] **GRAPH-03**: Implement personalized PageRank where files matching a query/context receive boosted seed weights
- [ ] **GRAPH-04**: Support dependency queries: "what does file X depend on?" (forward edges)
- [ ] **GRAPH-05**: Support reverse dependency queries: "what depends on file X?" (reverse edges)
- [ ] **GRAPH-06**: Compute transitive reverse-dependency closure for impact analysis ("if I change X, what is affected?")

### Rendering

- [ ] **REND-01**: Render ranked files as a hierarchical directory tree with indented definitions, sorted by PageRank score
- [ ] **REND-02**: Enforce configurable token budget (default: 2048 tokens) using ~3 chars/token approximation for tree output
- [ ] **REND-03**: Greedily fill token budget by PageRank rank — highest-ranked files and definitions appear first
- [ ] **REND-04**: Render maps in JSON format with graph structure, scores, and metadata for programmatic consumption
- [ ] **REND-05**: Token count display on all rendered output

### MCP Server

- [ ] **MCP-01**: Implement MCP server using @modelcontextprotocol/sdk with stdio transport
- [ ] **MCP-02**: Expose `graft_map` tool — ranked tree map with optional `query` param for personalization and `budget` param for token limit
- [ ] **MCP-03**: Expose `graft_context` tool — given a file path or symbol name, return the relevant subgraph (dependencies + reverse dependencies + sibling definitions)
- [ ] **MCP-04**: Expose `graft_search` tool — structural search by definition name, kind, or pattern against the indexed graph
- [ ] **MCP-05**: Expose `graft_impact` tool — return transitive reverse-dependency closure for a given file or symbol
- [ ] **MCP-06**: Expose `graft_summary` tool — project overview with top-level modules, entry points, key abstractions, and detected tech stack
- [ ] **MCP-07**: Expose `graft://map` MCP resource — the full ranked tree map
- [ ] **MCP-08**: Expose `graft://file/{path}` MCP resource — contextual view of a specific file with its relationships
- [ ] **MCP-09**: Keep total MCP tool schema serialization under 4,000 characters to minimize token overhead

### CLI

- [ ] **CLI-01**: `graft serve` command starts the MCP server over stdio
- [ ] **CLI-02**: `graft map` command outputs the ranked tree map to stdout with optional `--focus` flag for file-specific personalization
- [ ] **CLI-03**: `graft stats` command displays indexing statistics (file count, definition count, edge count, cache age)
- [ ] **CLI-04**: `graft impact <path>` command shows what files would be affected by changing the given file
- [ ] **CLI-05**: `graft search <query>` command finds definitions by name with optional `--kind` filter
- [ ] **CLI-06**: Beautiful terminal output with colors (chalk), tree-drawing characters, and progress spinners (ora)
- [ ] **CLI-07**: Default command (`npx graft` with no args) indexes current directory and starts MCP server

### Infrastructure

- [x] **INFRA-01**: .gitignore-aware file discovery that also skips node_modules, vendor, dist, build, .git by default
- [x] **INFRA-02**: Support custom ignore patterns via optional `.graftignore` or CLI flag
- [ ] **INFRA-03**: Serialize parsed graph to `.graft/cache.json` for fast restart with file-hash-based invalidation
- [x] **INFRA-04**: Zero-config startup — works in any directory without config files
- [x] **INFRA-05**: All stdout reserved for MCP JSON-RPC when running as server; logging goes to stderr only
- [x] **INFRA-06**: Actionable error messages that tell the user what to do, not just what failed

### Quality

- [ ] **QUAL-01**: Unit tests for every module (parser, graph, renderer, MCP tools) with >90% coverage on core modules
- [ ] **QUAL-02**: Integration tests with fixture codebases (TypeScript project, Python project, mixed-language project)
- [ ] **QUAL-03**: Snapshot tests for tree renderer output to catch formatting regressions
- [ ] **QUAL-04**: E2E tests that spin up the MCP server, connect a client, call tools, and verify responses
- [x] **QUAL-05**: Strict TypeScript — no `any`, no unsafe `as` casts, all functions have explicit return types
- [x] **QUAL-06**: ESLint + Prettier enforced, CI pipeline with GitHub Actions

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Languages

- **LANG-01**: Go language support (definitions + references extraction)
- **LANG-02**: Rust language support (definitions + references extraction)
- **LANG-03**: Java language support (definitions + references extraction)
- **LANG-04**: Ruby language support (definitions + references extraction)
- **LANG-05**: C/C++ language support (definitions + references extraction)
- **LANG-06**: PHP language support (definitions + references extraction)

### File Watcher

- **WATCH-01**: File system watcher for detecting changes in real-time
- **WATCH-02**: Debounced change batching to avoid re-indexing on every keystroke
- **WATCH-03**: Incremental re-indexing (re-parse only changed files, update affected edges)
- **WATCH-04**: Cache invalidation for graph nodes affected by file changes

### Open Source Polish

- **OSS-01**: README.md with hero section, animated terminal GIF, quick start, MCP integration guides, architecture diagram
- **OSS-02**: CONTRIBUTING.md with setup instructions, architecture overview, PR process
- **OSS-03**: GitHub issue templates (bug report, feature request)
- **OSS-04**: npm publish configuration with `npx graft` zero-install experience
- **OSS-05**: Performance benchmarks on real-world repos (Next.js, Express, FastAPI)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Semantic vector embeddings / search | Requires cloud API (violates local-first) or bundled ONNX (50MB+ bloat). Structural graph search covers 90% of agent use cases. |
| GUI or web interface | Duplicates IDE functionality. CLI + MCP is the right interface for this tool. |
| Cloud sync / team-shared indexes | Breaks local-first constraint. Adds auth/infra complexity. Kill it before it starts. |
| Dead code detection | Requires whole-program analysis with full type resolution — significantly harder than reachability. Graph structure enables this post-v1. |
| Cypher/GraphQL query language | Adds parser + planner + executor. The 5 MCP tools cover the access patterns AI agents need. |
| Real-time file watching (v1) | Spawned-per-call MCP model makes watcher state unretainable. Cache + hash invalidation is the v1 approach. |
| Languages beyond TS/JS + Python (v1) | Correctness > breadth. Ship two languages well, add by demand. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PARSE-01 | Phase 1 | Complete |
| PARSE-02 | Phase 1 | Complete |
| PARSE-03 | Phase 1 | Complete |
| PARSE-04 | Phase 1 | Complete |
| PARSE-05 | Phase 1 | Complete |
| PARSE-06 | Phase 1 | Complete |
| GRAPH-01 | Phase 2 | Pending |
| GRAPH-02 | Phase 2 | Pending |
| GRAPH-03 | Phase 2 | Pending |
| GRAPH-04 | Phase 2 | Pending |
| GRAPH-05 | Phase 2 | Pending |
| GRAPH-06 | Phase 2 | Pending |
| REND-01 | Phase 2 | Pending |
| REND-02 | Phase 2 | Pending |
| REND-03 | Phase 2 | Pending |
| REND-04 | Phase 2 | Pending |
| REND-05 | Phase 2 | Pending |
| MCP-01 | Phase 3 | Pending |
| MCP-02 | Phase 3 | Pending |
| MCP-03 | Phase 3 | Pending |
| MCP-04 | Phase 3 | Pending |
| MCP-05 | Phase 3 | Pending |
| MCP-06 | Phase 3 | Pending |
| MCP-07 | Phase 3 | Pending |
| MCP-08 | Phase 3 | Pending |
| MCP-09 | Phase 3 | Pending |
| CLI-01 | Phase 3 | Pending |
| CLI-02 | Phase 3 | Pending |
| CLI-03 | Phase 3 | Pending |
| CLI-04 | Phase 3 | Pending |
| CLI-05 | Phase 3 | Pending |
| CLI-06 | Phase 3 | Pending |
| CLI-07 | Phase 3 | Pending |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 2 | Pending |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 1 | Complete |
| QUAL-01 | Phase 4 | Pending |
| QUAL-02 | Phase 4 | Pending |
| QUAL-03 | Phase 4 | Pending |
| QUAL-04 | Phase 4 | Pending |
| QUAL-05 | Phase 1 | Complete |
| QUAL-06 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after roadmap creation — all 45 requirements mapped*
