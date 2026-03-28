# Feature Research

**Domain:** Codebase context engine / code intelligence MCP server
**Researched:** 2026-03-27
**Confidence:** HIGH (competitive analysis from 8+ existing tools; Aider, Cursor, Sourcegraph, codebase-memory-mcp, CKB, Repomix, CodeMCP, AFT)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that every tool in this space already has. Missing these means users immediately reach for a competitor.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| AST-based symbol extraction (functions, classes, methods, types) | Aider repo-map, every serious competitor uses tree-sitter; text-grep is unacceptable | MEDIUM | tree-sitter covers TS/JS/Python well; WASM vs native binding is an open question (see PITFALLS) |
| Dependency graph construction (file → file edges via imports/references) | Without this, rank-by-recency is the only alternative — which is useless | MEDIUM | Directed graph; one node per file, edges per import/require/from |
| Token-budget-aware context rendering | LLMs have fixed windows; the tool must fit within them or it's unusable | MEDIUM | Aider defaults to 1K tokens, adjusts dynamically; Graft targets ~2K for 100K LOC |
| .gitignore-aware file discovery | Every tool does this; not doing it means indexing node_modules and failing on large repos | LOW | Also skip dist/, build/, vendor/, .git/ by default |
| Symbol-level search by name or kind | "Find the AuthService class" is the first thing any AI coding agent needs to do | LOW | Filter by symbol kind (function/class/interface/type/method) and name pattern |
| Structural project overview (entry points, modules, tech stack) | AI agents need orientation before diving into files; every IDE does this | MEDIUM | Detect package.json/pyproject.toml/requirements.txt for stack; identify entry files |
| Ranked/prioritized context output | PageRank or similar — return the most-referenced symbols first, not alphabetically | MEDIUM | Aider uses graph ranking; Graft uses personalized PageRank with query-boosted weights |
| MCP tool exposure | The entire point — the tool serves context via MCP protocol | MEDIUM | Minimum: tools for map, search, context; resources for graft://map and graft://file/{path} |
| Zero-config startup (`npx graft`) | Developer tools that require config files get abandoned; Repomix, codebase-memory-mcp, AFT all run without config | LOW | Works in any repo directory; no .graftrc required |
| In-repo cache for fast restarts | Parsing a 100K LOC repo on every MCP call is a 10s tax; unacceptable | LOW | `.graft/cache.json` is sufficient for v1; file-hash invalidation |

### Differentiators (Competitive Advantage)

Features that distinguish Graft from the current field. These map directly to the core value proposition.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Personalized PageRank (query-boosted weights) | Every competitor does static ranking or recency; personalizing by the current query dramatically improves relevance — this is Graft's core intellectual property | HIGH | Seed PageRank with query-matched nodes; standard 0.85 damping; converge at delta < 1e-6 |
| Transitive reverse-dependency closure (`graft_impact`) | "What breaks if I change X?" is the #1 question AI agents get wrong. Only heavy tools (Sourcegraph, codebase-memory-mcp) answer it today; no lightweight MCP-native tool does | HIGH | BFS traversal of reverse edges from a symbol; grouped by depth; return affected files + symbols |
| Token-budget rendering with configurable ceiling | Aider hardcodes 1K default and only adjusts heuristically; Graft lets callers specify exact budgets and renders optimally within them | MEDIUM | 4-chars-per-token approximation; hierarchical pruning by PageRank score |
| Dual output format: tree (human-readable) + JSON (programmatic) | Repomix outputs flat text blobs; Aider's map is display-only. Graft gives AI agents structured JSON they can operate on programmatically | LOW | JSON format exposes the graph structure, scores, and metadata |
| Tool-agnostic MCP-native delivery | Aider's repo-map is baked into Aider; Cursor's indexing is proprietary. Graft works with any MCP client: Claude Code, Cursor, Zed, Aider, VS Code Copilot | LOW | Pure MCP server; no client lock-in |
| `graft_context` subgraph for a file or symbol | "What does this file depend on, and what depends on it?" — immediate context for AI editing. No existing lightweight tool exposes this as a discrete MCP tool | MEDIUM | 1-hop neighborhood in both directions from a node |
| Beautiful CLI output (tree-drawing, colors, spinners) | Most code intelligence tools have ugly or no CLI; developer tools live or die on DX — Aider succeeds partly because it's beautiful | LOW | chalk + ora; shows hierarchy with box-drawing chars |
| Local-first, zero telemetry, no cloud dependencies | Cursor sends code to servers; Sourcegraph requires cloud. Privacy-conscious developers are underserved; this is a hard constraint and a marketing differentiator | LOW | No HTTP calls outside MCP; all processing in-process |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time file watching / incremental re-indexing | Sounds like a must-have; developers want the index to stay fresh | Most MCP servers spawn a new process per tool call, making watcher state unretainable. Adds significant implementation complexity (chokidar, debouncing, partial graph invalidation) for a benefit that only materializes with a long-running daemon model. Wrong for v1. | Cache-on-disk with hash-based invalidation; re-index on `graft serve` startup and on explicit `graft stats`. Defer watcher to Phase 6 as specified. |
| Semantic vector search / embeddings | "Find code semantically similar to X" is a compelling demo | Requires external embedding model (OpenAI API) or bundled ONNX runtime — both violate local-first constraint or add 50MB+ to install. Structural graph search covers 90% of agent use cases without embeddings. | Personalized PageRank with query term matching on symbol names achieves good-enough semantic relevance structurally. Add embeddings post-v1 if demand proves it. |
| 66-language support at launch | More languages = more users | tree-sitter grammars for each language add download weight and parsing surface area. Correctness matters more than breadth. TS/JS + Python are the most AI-assisted languages (validated by Stack Overflow 2025 data). | Ship TS/JS + Python for v1. Add languages by user demand with a clean grammar-registration interface. |
| GUI or web interface | Looks impressive in demos | Duplicates VS Code / Cursor's job; adds a React app dependency; not how developers use code intelligence tools | Invest in CLI output quality and MCP integration depth instead |
| Cloud sync / team-shared indexes | Enterprise feature; increases addressable market | Breaks local-first constraint, adds auth/infra complexity, turns a library into a SaaS product. Kill it before it starts. | Open source + local-first builds trust; team features can be a future paid layer on top |
| Dead code detection | Useful, but often requested as a "while you're at it" | Dead code analysis requires whole-program analysis with full type resolution — significantly harder than reachability. A wrong false-positive here wastes developer time. | Out of scope for v1; the graph structure enables it post-v1 when confidence in graph correctness is high |
| Cypher/GraphQL query language for custom graph traversal | Power users want programmable graph access | Adds a query parser, planner, and execution engine. The MCP tools (map, context, search, impact) cover the access patterns AI agents actually need. A query language optimizes for humans, not agents. | Provide `graft_context` and `graft_impact` as composable primitives; agents can chain them |

---

## Feature Dependencies

```
[AST Symbol Extraction]
    └──requires──> [File Discovery (.gitignore aware)]
    └──feeds──> [Dependency Graph Construction]

[Dependency Graph Construction]
    └──requires──> [AST Symbol Extraction]
    └──enables──> [PageRank Ranking]
    └──enables──> [graft_impact (reverse-dep closure)]
    └──enables──> [graft_context (subgraph)]

[PageRank Ranking]
    └──requires──> [Dependency Graph Construction]
    └──enables──> [Token-Budget Rendering]
    └──enables──> [graft_map (ranked map)]

[Token-Budget Rendering]
    └──requires──> [PageRank Ranking]
    └──enables──> [graft_map MCP tool]
    └──produces──> [Tree format output]
    └──produces──> [JSON format output]

[In-Repo Cache]
    └──requires──> [AST Symbol Extraction]
    └──enhances──> [All MCP tools] (startup speed)

[MCP Tool Exposure]
    └──requires──> [All core features above]
    └──includes──> [graft_map, graft_context, graft_search, graft_impact, graft_summary]
    └──includes──> [graft://map resource, graft://file/{path} resource]

[Personalized PageRank] ──enhances──> [PageRank Ranking] (query arg changes seed weights)

[graft_impact] ──conflicts──> [Real-time file watching] (stateless per-call model vs daemon model)
```

### Dependency Notes

- **File discovery requires nothing** — it is the base primitive everything else builds on
- **Dependency graph requires symbol extraction** — you can't draw import edges without first knowing what symbols are exported from each file
- **PageRank requires the complete graph** — partial graphs produce misleading scores; build fully before ranking
- **Token-budget rendering requires ranked scores** — pruning without scores is arbitrary; you need ranks to decide what to cut
- **MCP tools require all of the above** — they are the delivery mechanism, not the intelligence layer; implement core engine first
- **Personalized PageRank enhances but does not replace** baseline PageRank — the MCP tool accepts an optional query arg; no query = global PageRank, query = personalized

---

## MVP Definition

### Launch With (v1)

Minimum viable product to validate the core proposition: "run `npx graft serve` and your AI assistant understands your codebase."

- [ ] File discovery with .gitignore awareness — foundation for everything
- [ ] tree-sitter AST parsing for TypeScript/JavaScript and Python — the two languages AI developers use most
- [ ] Dependency graph construction (files as nodes, import references as edges) — required for ranking
- [ ] Personalized PageRank ranking — the core differentiator; don't ship without it
- [ ] Token-budget-aware rendering in tree format — the output that AI agents actually consume
- [ ] JSON format output — makes MCP tools programmable
- [ ] `graft_map` MCP tool — the primary entry point for any AI assistant
- [ ] `graft_search` MCP tool — symbol lookup by name/kind; needed for agent navigation
- [ ] `graft_context` MCP tool — subgraph for a file; immediate utility for editing sessions
- [ ] `graft_impact` MCP tool — reverse-dependency closure; the feature no lightweight competitor has
- [ ] `graft_summary` MCP tool — project orientation; first thing any agent calls
- [ ] `graft://map` and `graft://file/{path}` MCP resources — passive context for agents that read resources
- [ ] In-repo cache (`.graft/cache.json`) — acceptable startup time on real repos
- [ ] CLI commands: `graft serve`, `graft map`, `graft stats`, `graft impact`, `graft search`
- [ ] Zero-config startup — works in any repo with `npx graft`

### Add After Validation (v1.x)

- [ ] Additional languages (Go, Rust, Java, Ruby) — add when language-specific user demand is demonstrated
- [ ] Incremental re-indexing with file watcher — add when long-running daemon model is validated (Phase 6 in spec)
- [ ] `--watch` flag on `graft serve` — natural evolution of the daemon model

### Future Consideration (v2+)

- [ ] Semantic vector search / embeddings — add when structural search is proven insufficient for a specific use case
- [ ] Multi-repo federation — add when team/monorepo use cases are validated
- [ ] Dead code detection — add once graph correctness has been battle-tested on real codebases
- [ ] Security scanning / secret detection — different product concern; only if user research demands it

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| File discovery + .gitignore | HIGH | LOW | P1 |
| tree-sitter parsing (TS/JS + Python) | HIGH | MEDIUM | P1 |
| Dependency graph construction | HIGH | MEDIUM | P1 |
| Personalized PageRank | HIGH | HIGH | P1 |
| Token-budget rendering (tree + JSON) | HIGH | MEDIUM | P1 |
| `graft_map` MCP tool | HIGH | LOW | P1 |
| `graft_search` MCP tool | HIGH | LOW | P1 |
| `graft_context` MCP tool | HIGH | MEDIUM | P1 |
| `graft_impact` MCP tool | HIGH | MEDIUM | P1 |
| `graft_summary` MCP tool | MEDIUM | LOW | P1 |
| In-repo cache | MEDIUM | LOW | P1 |
| CLI output quality (colors, spinners) | MEDIUM | LOW | P1 |
| MCP resources (graft://map, file) | MEDIUM | LOW | P1 |
| File watcher / incremental re-index | MEDIUM | HIGH | P3 |
| Additional languages | MEDIUM | MEDIUM | P2 |
| Semantic vector search | LOW | HIGH | P3 |
| Dead code detection | LOW | HIGH | P3 |
| GUI / web interface | LOW | HIGH | P3 (anti-feature) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Aider repo-map | Cursor indexing | codebase-memory-mcp | Repomix | Graft |
|---------|----------------|-----------------|---------------------|---------|-------|
| Parsing tech | tree-sitter | Proprietary chunking + embeddings | tree-sitter (66 langs) | tree-sitter (compression only) | tree-sitter (TS/JS + Python) |
| Graph construction | Yes (ranking graph) | No (vector similarity) | Yes (knowledge graph) | No | Yes (directed dep graph) |
| Ranking algorithm | Graph PageRank | Nearest-neighbor vector search | Louvain community + traversal | None | Personalized PageRank |
| Token budget control | Yes (--map-tokens, dynamic) | No (fixed chunking) | No | Approximate | Yes (explicit per-call budget) |
| Impact analysis | No | No | Yes (trace_call_path) | No | Yes (graft_impact) |
| MCP-native | No (baked into Aider) | No (proprietary) | Yes | Yes (experimental) | Yes (primary interface) |
| Local-first | Yes | No (cloud embeddings) | Yes | Yes | Yes (hard constraint) |
| Zero-config | Yes | Yes | No (install steps) | Yes | Yes |
| Open source | Yes (MIT) | No | Yes | Yes (MIT) | Yes (MIT) |
| Output formats | Text tree | None (internal) | Structured JSON | Plain text / XML | Tree + JSON |
| Personalized ranking | Yes (per-chat files) | Implicit (similarity) | No | No | Yes (explicit query arg) |
| CLI usable standalone | No (only within Aider) | No | No | Yes | Yes |

---

## Sources

- Aider repo-map documentation: https://aider.chat/docs/repomap.html
- Aider tree-sitter approach: https://aider.chat/2023/10/22/repomap.html
- Cursor codebase indexing docs: https://docs.cursor.com/context/codebase-indexing
- Cursor secure indexing deep-dive: https://cursor.com/blog/secure-codebase-indexing
- codebase-memory-mcp: https://github.com/DeusData/codebase-memory-mcp
- CodeMCP (CKB): https://github.com/SimplyLiz/CodeMCP
- Repomix MCP server: https://repomix.com/guide/mcp-server
- Sourcegraph code navigation: https://sourcegraph.com/docs/code-navigation/features
- Code intelligence tools comparison: https://rywalker.com/research/code-intelligence-tools
- AI coding assistants for large codebases: https://blog.kilo.ai/p/ai-coding-assistants-for-large-codebases
- AFT (tree-sitter powered analysis): https://github.com/ualtinok/aft
- RepoMapper MCP (PageRank + tree-sitter): https://mcpservers.org/servers/pdavis68/RepoMapper

---

*Feature research for: codebase context engine / MCP developer tool*
*Researched: 2026-03-27*
