# Architecture Research

**Domain:** Codebase context engine / MCP developer tool
**Researched:** 2026-03-27
**Confidence:** HIGH (validated against aider's production implementation, MCP TypeScript SDK docs, tree-sitter official docs)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  map cmd │  │serve cmd │  │stats cmd │  │impact cmd│    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       └─────────────┴──────┬───────┴──────────────┘         │
├────────────────────────────┼────────────────────────────────┤
│                     Index Layer                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Indexer (orchestrator)               │  │
│  │  ┌──────────────┐      ┌──────────────────────────┐   │  │
│  │  │ FileDiscovery│──────│      Parser               │   │  │
│  │  │ (.gitignore  │      │  (tree-sitter, per-lang   │   │  │
│  │  │  aware glob) │      │   tags.scm queries)       │   │  │
│  │  └──────────────┘      └──────────────┬───────────┘   │  │
│  │                                        │ Tag[]         │  │
│  │                               ┌────────▼─────────┐    │  │
│  │                               │   GraphBuilder   │    │  │
│  │                               │ (nodes=files,    │    │  │
│  │                               │  edges=refs)     │    │  │
│  │                               └────────┬─────────┘    │  │
│  │                                        │ Graph         │  │
│  │                               ┌────────▼─────────┐    │  │
│  │                               │   RankEngine     │    │  │
│  │                               │ (PageRank + pers-│    │  │
│  │                               │  onalization)    │    │  │
│  │                               └────────┬─────────┘    │  │
│  └────────────────────────────────────────┼──────────────┘  │
├────────────────────────────────────────────┼────────────────┤
│                    Render Layer             │                 │
│                               ┌────────────▼────────────┐   │
│                               │      Renderer            │   │
│                               │ (token-budgeted tree/    │   │
│                               │  JSON output)            │   │
│                               └────────────┬─────────────┘  │
├────────────────────────────────────────────┼────────────────┤
│                    Serve Layer              │                 │
│  ┌──────────────────────────────────────────▼────────────┐  │
│  │                    MCP Server                          │  │
│  │  tools: graft_map, graft_context, graft_search,       │  │
│  │         graft_impact, graft_summary                   │  │
│  │  resources: graft://map, graft://file/{path}          │  │
│  │  transport: stdio (local, npx-spawned)                │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Cache Layer                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         .graft/cache.json (in-memory + disk)         │    │
│  │         key: file path + mtime → cached Tag[]        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| FileDiscovery | Walk the repo, apply .gitignore rules, enumerate source files | glob + ignore library |
| Parser | Convert source files to Tag[] (name, kind, line, file) via tree-sitter queries | web-tree-sitter WASM + per-language tags.scm |
| GraphBuilder | Build in-memory directed graph: file nodes, reference edges weighted by count | Plain Map<string, Map<string, number>> adjacency |
| RankEngine | Run personalized PageRank over the graph; accept optional query/file bias | Iterative PageRank, damping=0.85, delta < 1e-6 |
| Renderer | Convert ranked file+symbol list to token-budgeted tree string or JSON | Binary search over budget, hierarchical dir format |
| Indexer | Orchestrate FileDiscovery → Parser → GraphBuilder; own cache invalidation | Single entry point, serial or async-parallel |
| MCP Server | Register tools/resources, handle MCP protocol, own stdio transport | @modelcontextprotocol/sdk McpServer + StdioServerTransport |
| Cache | Persist parsed Tag[] keyed by file path + mtime; invalidate on change | JSON file at .graft/cache.json, loaded at startup |

## Recommended Project Structure

```
src/
├── cli/                    # CLI command wiring only — no logic
│   ├── index.ts            # Entry point, command registration (commander)
│   ├── commands/
│   │   ├── map.ts          # graft map → Indexer + Renderer
│   │   ├── serve.ts        # graft serve → Indexer + MCP Server
│   │   ├── stats.ts        # graft stats → Indexer + stats formatter
│   │   ├── impact.ts       # graft impact → RankEngine reverse closure
│   │   └── search.ts       # graft search → structural search
│   └── output.ts           # Colors, spinners, tree-drawing characters
│
├── indexer/                # Core pipeline orchestrator
│   ├── index.ts            # Indexer class — drives the full parse pipeline
│   ├── discovery.ts        # FileDiscovery — glob + .gitignore filtering
│   └── cache.ts            # Cache — read/write .graft/cache.json
│
├── parser/                 # Tree-sitter extraction layer
│   ├── index.ts            # Parser — dispatches to language-specific extractors
│   ├── types.ts            # Tag type definition
│   ├── loader.ts           # WASM grammar loader (web-tree-sitter init)
│   └── languages/
│       ├── typescript.ts   # TS/JS extractor — runs tags.scm query
│       └── python.ts       # Python extractor — runs tags.scm query
│
├── graph/                  # Graph construction and ranking
│   ├── builder.ts          # GraphBuilder — Tag[] → adjacency map
│   ├── types.ts            # Graph, Node, Edge type definitions
│   └── rank.ts             # RankEngine — personalized PageRank
│
├── renderer/               # Output formatting
│   ├── index.ts            # Renderer entry — dispatches tree vs JSON
│   ├── tree.ts             # Hierarchical tree formatter
│   ├── json.ts             # JSON formatter for programmatic consumers
│   └── budget.ts           # Token counting (4 chars ≈ 1 token), binary search
│
├── mcp/                    # MCP server
│   ├── server.ts           # McpServer instantiation + transport connect
│   ├── tools/
│   │   ├── map.ts          # graft_map tool handler
│   │   ├── context.ts      # graft_context tool handler
│   │   ├── search.ts       # graft_search tool handler
│   │   ├── impact.ts       # graft_impact tool handler
│   │   └── summary.ts      # graft_summary tool handler
│   └── resources/
│       ├── map.ts          # graft://map resource
│       └── file.ts         # graft://file/{path} resource
│
└── types.ts                # Shared types (root)
```

### Structure Rationale

- **cli/:** Contains zero business logic — pure wiring. Keeps commands thin and testable.
- **indexer/:** The only component that knows about the file system and cache. Owns the full parse lifecycle.
- **parser/:** Isolated behind a clean Tag[] interface so language support can be added without touching graph or render code.
- **graph/:** Pure functions — GraphBuilder and RankEngine take inputs and return outputs, no I/O. Easiest to unit test.
- **renderer/:** Depends only on ranked file+symbol data, not on the graph or parser. The token budget logic lives entirely here.
- **mcp/:** Depends on Indexer and Renderer but knows nothing about parsing internals. Each tool handler is a thin adapter.

## Architectural Patterns

### Pattern 1: Tag as the Universal Data Contract

**What:** Every language-specific parser outputs the same `Tag` type: `{ file: string, name: string, kind: 'def' | 'ref', line: number }`. Nothing downstream knows about ASTs.

**When to use:** Always — this is the core seam that makes the pipeline composable and language-agnostic.

**Trade-offs:** Loses some language-specific richness (e.g., method vs function distinction requires extending `kind`), but the simplicity is worth it for v1.

```typescript
export type TagKind = 'def' | 'ref';

export interface Tag {
  file: string;     // absolute path
  name: string;     // identifier name
  kind: TagKind;
  line: number;
}
```

### Pattern 2: Personalized PageRank via Seed Weights

**What:** Standard PageRank assigns uniform dangling-node weights. Graft overrides the personalization vector: files matching a query/context get weight `100 / total_files`, others get `1 / total_files`. This biases rank scores toward the caller's intent without changing the algorithm.

**When to use:** All `graft_map`, `graft_context` tool calls with an optional `query` parameter. When no query is provided, use uniform weights (global importance).

**Trade-offs:** Simple and fast (no embeddings, no vector store). Accuracy degrades for semantic similarity vs structural — but structural is the correct goal here.

```typescript
function buildPersonalizationVector(
  files: string[],
  boostedFiles: Set<string>
): Map<string, number> {
  const boost = 100 / files.length;
  const base = 1 / files.length;
  return new Map(files.map(f => [f, boostedFiles.has(f) ? boost : base]));
}
```

### Pattern 3: Token Budget via Binary Search

**What:** Render candidates in PageRank-descending order. Track cumulative token estimate (byte length / 4). Binary search for the maximum number of files that fits within the budget. Optionally truncate definition lists per file if needed.

**When to use:** All rendering — tree and JSON — must respect the budget. Never silently overflow.

**Trade-offs:** The 4 chars ≈ 1 token approximation is intentionally coarse (avoids tiktoken dependency). Real overflow risk is low because the approximation slightly over-estimates token count, providing a natural safety margin.

### Pattern 4: Lazy WASM Initialization

**What:** web-tree-sitter requires an async `Parser.init()` call before any parsing. Grammar `.wasm` files are loaded on first use per language and cached in a module-level Map. The Indexer awaits initialization once at startup.

**When to use:** Always for WASM-based parsers. Prevents duplicate initialization and WASM ABI version conflicts at load time.

**Trade-offs:** First parse is slower due to WASM load. Subsequent parses use cached parser instances — no re-initialization overhead.

```typescript
const parserCache = new Map<string, Parser>();

async function getParser(language: string): Promise<Parser> {
  if (parserCache.has(language)) return parserCache.get(language)!;
  const parser = new Parser();
  const lang = await Parser.Language.load(`tree-sitter-${language}.wasm`);
  parser.setLanguage(lang);
  parserCache.set(language, parser);
  return parser;
}
```

### Pattern 5: Cache-First Parsing

**What:** Before invoking tree-sitter on a file, check `.graft/cache.json` for an entry keyed by `{path}:{mtime}`. On hit, return cached Tag[]. On miss, parse and write back. Load the entire cache JSON into memory at startup; flush to disk after full index pass.

**When to use:** All parse operations. The cache is the primary reason re-running `graft map` is fast on unchanged repos.

**Trade-offs:** mtime-based invalidation misses content-identical writes that touch mtime, and can miss sub-second edits on some filesystems. For v1 this is acceptable — the file watcher (deferred to post-v1) will address it.

## Data Flow

### Indexing Pipeline (graft map / graft serve startup)

```
FileDiscovery
    │ string[] (file paths)
    ▼
Cache.load()         ← .graft/cache.json
    │
    ├─ CACHE HIT  → Tag[] (skip parse)
    └─ CACHE MISS → Parser.extract(file) → Tag[]
                         │ (tree-sitter WASM)
                         │ runs tags.scm query
                         ▼
                    Cache.write(path, mtime, Tag[])
    │
    ▼ Tag[] (all files)
GraphBuilder.build(tags)
    │ Graph (adjacency map: file → Map<file, refCount>)
    ▼
RankEngine.rank(graph, personalizationVector?)
    │ Map<string, number> (file → score)
    ▼
Renderer.render(rankedFiles, graph, budget)
    │ string (tree) or object (JSON)
    ▼
[CLI output / MCP tool response]
```

### MCP Tool Request Flow

```
MCP Client (Claude / Cursor / Aider)
    │ JSON-RPC over stdio
    ▼
McpServer (tool dispatcher)
    │
    ├─ graft_map(query?, maxTokens?)
    │      │
    │      ├─ Indexer.getIndex()       ← cached in-memory after first call
    │      ├─ RankEngine.rank(query)
    │      └─ Renderer.tree(budget)
    │
    ├─ graft_context(file | symbol)
    │      │
    │      ├─ Indexer.getIndex()
    │      └─ GraphBuilder.subgraph(target, depth=2)
    │
    ├─ graft_impact(file | symbol)
    │      │
    │      ├─ Indexer.getIndex()
    │      └─ GraphBuilder.reverseClosure(target)
    │
    └─ graft_search(name?, kind?, pattern?)
           │
           ├─ Indexer.getIndex()
           └─ Tag[].filter(predicate)
```

### Key Data Flows

1. **Tag extraction:** Source file bytes → tree-sitter AST → `.scm` query captures → `Tag[]`. This is the only place tree-sitter is touched. Everything else operates on `Tag[]`.

2. **Graph construction:** `Tag[]` grouped by `name`. For each `ref` tag, find all `def` tags with the same name. Add an edge from the ref's file to the def's file. Edge weight = number of such references.

3. **PageRank convergence:** Iterative power method. Each iteration: new_score[v] = (1-d)/N + d * sum(score[u] * weight(u,v) / out_degree(u)). Stop when max delta < 1e-6 or after 100 iterations.

4. **Token budget:** Sort files by score descending. Walk the list, accumulating `floor(byteLength / 4)` per entry. Stop when budget exceeded. Remaining files are truncated entirely; the last included file may have its definition list trimmed.

5. **Cache lifecycle:** JSON loaded into `Map<cacheKey, Tag[]>` on startup. Dirty flag set on any write. After full index pass, flush to disk only if dirty. Startup cost is O(cache_size) deserialization once.

## Scaling Considerations

This is a local CLI/MCP tool. "Scale" means codebase size, not concurrent users.

| Codebase Size | Concern | Approach |
|---------------|---------|----------|
| < 10K LOC | None | In-memory everything, no cache needed |
| 10K–500K LOC | Parse time on cold start | Cache-first parsing; warm start < 100ms |
| 500K–2M LOC | Memory for Tag[] | Tag[] is ~200 bytes/tag; 5M tags ≈ 1GB; acceptable |
| > 2M LOC | PageRank iteration time | Sparse graph stays fast; prune files with 0 edges from rank computation |

### Scaling Priorities

1. **First bottleneck:** Cold-start parse time on large repos. Fix with cache. Target: < 2s for 100K LOC warm, < 30s cold.
2. **Second bottleneck:** PageRank iteration on dense graphs. Fix with edge weight normalization and early convergence cutoff. Unlikely to be hit in practice — real codebases are sparse graphs.

## Anti-Patterns

### Anti-Pattern 1: Piping ASTs Between Components

**What people do:** Pass the raw tree-sitter `Tree` or `Node` objects through the pipeline to preserve "full fidelity."

**Why it's wrong:** Creates tight coupling to tree-sitter's object model, makes caching impossible (trees are not serializable), and forces every downstream component to understand tree-sitter's API. Any language refactor becomes a full-pipeline change.

**Do this instead:** Extract to `Tag[]` immediately in the Parser layer. Everything downstream receives only `Tag[]`.

### Anti-Pattern 2: Per-Request Full Re-Index

**What people do:** Re-run FileDiscovery → Parser → GraphBuilder on every MCP tool call to ensure freshness.

**Why it's wrong:** A 100K LOC codebase takes seconds to index from cold. Re-indexing on every `graft_map` call makes the MCP tool unusable interactively.

**Do this instead:** The Indexer holds the current index in memory after the first build. MCP tool handlers call `Indexer.getIndex()` which returns the in-memory Graph immediately. Freshness is best-effort for v1 (user re-runs `graft serve` if stale). File watcher addresses this post-v1.

### Anti-Pattern 3: Embedding Language Detection in the Parser

**What people do:** A single monolithic parser class with `if (ext === '.ts') ... else if (ext === '.py') ...` branches.

**Why it's wrong:** Adding a new language requires touching the core parser class. Extension mapping, grammar loading, and query selection all become tangled.

**Do this instead:** A `loader.ts` maps extensions to grammar WASM paths. Each language module exports a `extract(source: string, parser: Parser): Tag[]` function. The top-level `Parser.extract(file)` loads grammar + delegates — it never contains language-specific logic.

### Anti-Pattern 4: MCP Server Owning Business Logic

**What people do:** Put ranking, rendering, and graph traversal directly inside MCP tool handler functions.

**Why it's wrong:** Tool handlers become untestable (MCP protocol required to invoke them) and the same logic can't be used by the CLI commands.

**Do this instead:** Tool handlers are thin adapters: parse MCP input params → call Indexer/RankEngine/Renderer → format result as MCP response. All logic lives in the core layers, tested independently of the MCP protocol.

### Anti-Pattern 5: Symmetric Edges in the Dependency Graph

**What people do:** Add edges in both directions (A references B, so add A→B and B→A) to make the graph "more connected."

**Why it's wrong:** PageRank on an undirected graph loses the directionality that makes rank meaningful. A widely-imported utility module should rank high because many files depend on it — not because it also happens to import many files.

**Do this instead:** Edges are strictly directed from the referencing file to the defining file. PageRank flows "upstream" through the dependency chain, naturally surfacing foundational modules.

## Integration Points

### External Services

None. Local-first is a hard constraint. No external services.

### Internal Boundaries

| Boundary | Communication | Contract |
|----------|---------------|----------|
| CLI → Indexer | Direct function call | `Indexer.build(rootDir): Promise<Index>` |
| CLI → Renderer | Direct function call | `Renderer.render(index, options): string` |
| CLI → MCP Server | N/A (serve command starts the server as long-running process) | — |
| Indexer → Parser | Direct function call | `Parser.extract(file: string): Promise<Tag[]>` |
| Indexer → Cache | Direct read/write | `Cache.get(key): Tag[] \| null`, `Cache.set(key, tags)` |
| Parser → tree-sitter WASM | WASM module API | `parser.parse(source)`, `query.matches(node)` |
| GraphBuilder → RankEngine | Direct function call | `RankEngine.rank(graph, weights?): Map<string, number>` |
| MCP Server → Indexer | Direct function call (shared in-process state) | `Indexer.getIndex(): Index` |
| MCP Server → Renderer | Direct function call | `Renderer.render(index, options): string` |

## Build Order Implications

Components have strict dependencies. Build in this order:

1. **Parser (Tag extraction)** — No dependencies on other Graft modules. Validate tree-sitter WASM loading and tags.scm queries work before anything else. This is the riskiest technical piece.
2. **GraphBuilder** — Depends only on `Tag[]`. Pure function, easy to test with fixture data.
3. **RankEngine** — Depends only on the Graph from GraphBuilder. Pure function. Validate PageRank convergence with known graphs.
4. **Renderer** — Depends on ranked file+symbol data. No I/O. Snapshot-testable.
5. **Indexer (with Cache)** — Wires FileDiscovery → Parser → GraphBuilder. First integration of I/O components.
6. **CLI commands** — Wire Indexer + Renderer + output formatting. First end-to-end test possible here.
7. **MCP Server** — Thin adapters over the already-tested pipeline. Integration tested with `@modelcontextprotocol/inspector`.

## Sources

- [Aider repo-map architecture](https://aider.chat/2023/10/22/repomap.html) — HIGH confidence (official aider documentation)
- [Aider Repository Mapping System deep-dive](https://deepwiki.com/Aider-AI/aider/4.1-repository-mapping-system) — MEDIUM confidence (third-party analysis, consistent with official source)
- [tree-sitter code navigation / tags.scm](https://tree-sitter.github.io/tree-sitter/4-code-navigation.html) — HIGH confidence (official tree-sitter documentation)
- [web-tree-sitter npm](https://www.npmjs.com/package/web-tree-sitter) — HIGH confidence (official package)
- [MCP TypeScript SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) — HIGH confidence (official MCP SDK documentation)
- [MCP build server guide](https://modelcontextprotocol.io/docs/develop/build-server) — HIGH confidence (official MCP documentation)
- [MCP server executables: npx, uvx, stdio](https://dev.to/leomarsh/mcp-server-executables-explained-npx-uvx-docker-and-beyond-1i1n) — MEDIUM confidence (community article, consistent with official docs)

---
*Architecture research for: Graft — codebase context engine*
*Researched: 2026-03-27*
