# Phase 2: Graph + Renderer — Research

**Researched:** 2026-03-28
**Domain:** Directed dependency graph, PageRank (standard + personalized), token-budgeted tree rendering, filesystem cache invalidation
**Confidence:** HIGH (algorithm correctness from authoritative academic + library sources; TypeScript patterns from existing project conventions)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GRAPH-01 | Build a directed dependency graph from parser output with files as nodes and import references as weighted edges | CodeNode.references array is the raw edge data; adjacency-list Map<string, Set<string>> is the correct in-memory structure for O(1) neighbor lookup |
| GRAPH-02 | PageRank with power iteration (damping 0.85, convergence delta < 1e-6, max 100 iterations) | Fully hand-rollable in ~60 lines of TypeScript; no external library supports the exact parameter set AND personalization together |
| GRAPH-03 | Personalized PageRank where files matching a query/context receive boosted seed weights | Requires custom implementation — graphology-metrics PageRank confirmed to have NO personalization vector support; ngraph.pagerank TODO lists it as future |
| GRAPH-04 | "What does file X depend on?" — forward edges | Forward adjacency list (file → imports) built as part of GRAPH-01 structure |
| GRAPH-05 | "What depends on file X?" — reverse edges | Reverse adjacency list (file → importedBy) built at graph construction time; O(1) lookup |
| GRAPH-06 | Transitive reverse-dependency closure — "if I change X, what is affected?" | BFS/DFS over reverse adjacency list; standard graph traversal, no library needed |
| REND-01 | Render ranked files as hierarchical directory tree with indented definitions, sorted by PageRank score | Pure string-building; sort files by score descending, group by directory path, draw with box-drawing chars |
| REND-02 | Enforce configurable token budget (default 2048 tokens) using ~3 chars/token approximation | ~3 chars/token is the correct approximation for code (denser than English prose at ~4 chars/token); use Math.ceil(chars / 3) |
| REND-03 | Greedy fill by PageRank rank — highest-ranked files appear first | Process files in score-descending order; accumulate char count; stop when budget exceeded |
| REND-04 | JSON output with graph structure, scores, and metadata | JSON.stringify of well-typed interface; no library needed |
| REND-05 | Token count display on all rendered output | Append `[~{N} tokens]` footer line after rendering completes |
| INFRA-03 | Cache at `.graft/cache.json` using filesystem fingerprint (path + size + mtime hash) for invalidation | fs.stat() for mtime + size; combine as `${mtime}:${size}` string per file; store in JSON; compare on load |
</phase_requirements>

---

## Summary

Phase 2 builds on the CodeNode output from Phase 1 to produce a ranked, navigable dependency graph and a token-efficient renderer. There are three distinct subsystems: the graph builder, the PageRank engine, and the renderer+cache.

**Graph Builder** converts `ParseResult[]` into a directed adjacency structure. Each file is a node; each import reference in `CodeNode.references` becomes a directed edge from the importing file to the imported file. Files that are imported by many others (high in-degree) should rank higher than entry-point files that import many others (high out-degree). This is standard PageRank semantics on a directed graph — no inversion needed.

**PageRank Engine** must be implemented from scratch. The two leading JavaScript PageRank libraries (ngraph.pagerank, graphology-metrics) both lack personalization vector support (GRAPH-03), and ngraph.pagerank flags it as a future TODO. The algorithm itself is only ~60 lines of TypeScript: build stochastic matrix from adjacency list, handle dangling nodes by redistributing their rank uniformly, iterate until L1 norm of delta < 1e-6 (capped at 100 iterations). Personalized PageRank replaces the uniform teleport vector `(1/N for all nodes)` with the caller-supplied seed weight vector, normalized to sum 1.0.

**Renderer + Cache** are the lowest-risk subsystem. The tree renderer sorts files by score descending, groups by directory, and accumulates characters until the budget is hit (~3 chars/token for code). The cache uses `fs.stat()` mtime+size as a fingerprint — no crypto hashing needed, no external library needed, no external dep added.

**Primary recommendation:** Implement the graph and PageRank engine as pure TypeScript with zero new runtime dependencies. The algorithms are well-understood, the implementation is ~200 lines total, and adding a library buys nothing while adding a maintenance burden and potential compatibility issues with the CJS build.

---

## Standard Stack

### Core (No New Runtime Dependencies)
| Module | Purpose | Notes |
|--------|---------|-------|
| `src/graph/index.ts` | Graph builder — converts ParseResult[] to FileGraph | New file, ~100 lines |
| `src/graph/pagerank.ts` | Standard + Personalized PageRank engine | New file, ~80 lines |
| `src/graph/traversal.ts` | Forward/reverse queries, transitive closure | New file, ~60 lines |
| `src/renderer/tree.ts` | Token-budgeted tree renderer | New file, ~80 lines |
| `src/renderer/json.ts` | JSON map renderer | New file, ~40 lines |
| `src/cache/index.ts` | Cache read/write with mtime+size fingerprint | New file, ~60 lines |
| Node.js `fs/promises` | `stat()` for fingerprint, `readFile/writeFile` for cache | Already in project |
| Node.js `path` | Directory grouping for tree renderer | Already in project |
| Node.js `crypto` | Optional: `createHash('md5')` if fingerprint collision risk deemed unacceptable | Standard library, no install |

### Alternatives Considered and Rejected
| Instead of | Could Use | Why Rejected |
|------------|-----------|-------------|
| Custom PageRank | `ngraph.pagerank` (v2.1.1) | No personalization vector; pure JS, no TS types; adds dep for ~30 lines of code |
| Custom PageRank | `graphology` + `graphology-metrics` | Confirmed: no personalization vector parameter; adds 2 deps; graphology graph object is overkill for our Map<string,Set<string>> needs |
| mtime+size fingerprint | crypto file-content hash (SHA1/MD5) | Content hash requires reading every file on startup — defeats the purpose of the cache; mtime+size is the standard Makefile/webpack cache invalidation pattern |
| Custom token estimator | `tiktoken` or `tokenx` npm package | ~3 chars/token is a deliberate approximation per REND-02 spec; adding a tokenizer dep would break the zero-config / minimal-install contract |

**Installation:** No new runtime dependencies required. All Phase 2 logic uses Node.js built-ins plus the existing project structure.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── graph/
│   ├── index.ts          # buildGraph(results: ParseResult[]): FileGraph
│   ├── pagerank.ts       # computePageRank(graph, options): Map<string, number>
│   └── traversal.ts      # forwardDeps, reverseDeps, transitiveClosure
├── renderer/
│   ├── tree.ts           # renderTree(graph, scores, options): string
│   └── json.ts           # renderJson(graph, scores, options): string
├── cache/
│   └── index.ts          # readCache, writeCache, fingerprint
└── parser/               # (Phase 1 — unchanged)
```

### Pattern 1: FileGraph Data Structure

**What:** Represent the dependency graph as two adjacency lists (forward + reverse) alongside the raw node data. Compute both directions at build time to avoid O(N²) reverse lookups at query time.

**When to use:** Always — this is the single graph representation for the entire application.

```typescript
// src/graph/index.ts
interface FileGraph {
  // All file paths in the graph (nodes)
  readonly files: ReadonlySet<string>;
  // filePath → set of filePaths it imports (forward edges)
  readonly forwardEdges: ReadonlyMap<string, ReadonlySet<string>>;
  // filePath → set of filePaths that import it (reverse edges)
  readonly reverseEdges: ReadonlyMap<string, ReadonlySet<string>>;
  // filePath → array of CodeNode from parser
  readonly definitions: ReadonlyMap<string, readonly CodeNode[]>;
}

function buildGraph(results: readonly ParseResult[]): FileGraph {
  const files = new Set<string>();
  const forwardEdges = new Map<string, Set<string>>();
  const reverseEdges = new Map<string, Set<string>>();
  const definitions = new Map<string, readonly CodeNode[]>();

  // Index all known files first (so dangling references stay in graph)
  for (const result of results) {
    files.add(result.filePath);
    definitions.set(result.filePath, result.nodes);
    if (!forwardEdges.has(result.filePath)) {
      forwardEdges.set(result.filePath, new Set());
    }
    if (!reverseEdges.has(result.filePath)) {
      reverseEdges.set(result.filePath, new Set());
    }
  }

  // Build edges from import references
  for (const result of results) {
    const importNodes = result.nodes.filter(n => n.kind === 'import');
    for (const importNode of importNodes) {
      for (const ref of importNode.references) {
        // ref is a file path (resolved by parser) — only add if it's a known file
        if (files.has(ref)) {
          forwardEdges.get(result.filePath)?.add(ref);
          reverseEdges.get(ref)?.add(result.filePath);
        }
      }
    }
  }

  return { files, forwardEdges, reverseEdges, definitions };
}
```

**CRITICAL EDGE DIRECTION NOTE:** The parser emits `references` as module path strings (e.g., `'../utils'`, `'./models'`). These are NOT yet resolved to absolute file paths. The graph builder must resolve import paths relative to the importing file's directory to match `result.filePath` keys. Unresolved imports (pointing outside the scanned tree, e.g. `node_modules`) are silently dropped — they have no corresponding node in `files`.

### Pattern 2: Import Path Resolution

**What:** Resolve relative module paths from `CodeNode.references` to absolute file paths that match keys in the `files` set.

**When to use:** During `buildGraph()` edge construction, for every import/export node reference.

```typescript
// Within buildGraph() — resolve a reference string to an absolute path
function resolveImportPath(
  importerFilePath: string,
  moduleRef: string,
  knownFiles: ReadonlySet<string>,
): string | null {
  // Skip non-relative imports (npm packages, built-ins)
  if (!moduleRef.startsWith('.')) return null;

  const importerDir = path.dirname(importerFilePath);
  const candidate = path.resolve(importerDir, moduleRef);

  // Try bare path, then with .ts, .tsx, .js, .py extensions, then /index.ts
  const extensions = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.py'];
  const candidates = [
    candidate,
    ...extensions.map(ext => `${candidate}${ext}`),
    ...extensions.map(ext => path.join(candidate, `index${ext}`)),
  ];

  for (const c of candidates) {
    if (knownFiles.has(c)) return c;
  }
  return null;
}
```

### Pattern 3: Standard PageRank (Power Iteration)

**What:** Compute PageRank scores for all files using the power iteration method. Files imported by many others score higher than entry-point files.

**Algorithm (verified against NetworkX docs and academic sources):**
1. Initialize all scores to `1/N`
2. Identify dangling nodes (no outgoing edges / no forward edges)
3. Per iteration:
   a. Compute dangling rank sum: sum of scores for all dangling nodes
   b. For each node `v`: new_score[v] = `alpha * (sum of score[u]/outDegree[u] for u in predecessors[v]) + alpha * (danglingRank / N) + (1 - alpha) / N`
   c. Compute L1 delta: `sum(|new_score[v] - score[v]|)`
   d. If delta < 1e-6, converge; else update scores and continue
4. Cap at 100 iterations

```typescript
// src/graph/pagerank.ts
interface PageRankOptions {
  readonly alpha: number;          // damping factor, default 0.85
  readonly maxIterations: number;  // default 100
  readonly tolerance: number;      // convergence delta, default 1e-6
  // If provided, personalization weights (must sum to 1.0 after normalization)
  readonly personalization?: ReadonlyMap<string, number>;
}

function computePageRank(
  graph: FileGraph,
  options: PageRankOptions,
): Map<string, number> {
  const { alpha, maxIterations, tolerance, personalization } = options;
  const nodes = Array.from(graph.files);
  const N = nodes.length;

  if (N === 0) return new Map();

  // Build teleport vector (uniform or personalized)
  const teleport = buildTeleportVector(nodes, personalization);

  // Initialize scores
  let scores = new Map<string, number>(nodes.map(n => [n, 1 / N]));

  // Precompute out-degrees (nodes with out-degree 0 are dangling)
  const outDegree = new Map<string, number>(
    nodes.map(n => [n, graph.forwardEdges.get(n)?.size ?? 0])
  );

  for (let iter = 0; iter < maxIterations; iter++) {
    // Sum rank of dangling nodes
    let danglingSum = 0;
    for (const [node, score] of scores) {
      if ((outDegree.get(node) ?? 0) === 0) danglingSum += score;
    }

    const newScores = new Map<string, number>();
    let delta = 0;

    for (const v of nodes) {
      // Rank from incoming links
      let linkRank = 0;
      const predecessors = graph.reverseEdges.get(v) ?? new Set();
      for (const u of predecessors) {
        const uOut = outDegree.get(u) ?? 1;
        linkRank += (scores.get(u) ?? 0) / uOut;
      }

      // Combine: link rank + dangling redistribution + teleport
      const tv = teleport.get(v) ?? (1 / N);
      const newScore = alpha * (linkRank + danglingSum * tv) + (1 - alpha) * tv;

      newScores.set(v, newScore);
      delta += Math.abs(newScore - (scores.get(v) ?? 0));
    }

    scores = newScores;

    if (delta < tolerance) break;
  }

  return scores;
}
```

### Pattern 4: Personalized PageRank

**What:** Replace the uniform teleport vector with a caller-supplied seed weight vector. Files matching a query get boosted teleport probability, causing the random walk to restart toward them more frequently, which raises scores of files they depend on.

**Formula difference:** In standard PageRank, teleport probability per node = `1/N`. In personalized: teleport probability per node = `seedWeight[node]` (normalized to sum 1.0).

```typescript
function buildTeleportVector(
  nodes: readonly string[],
  personalization: ReadonlyMap<string, number> | undefined,
): Map<string, number> {
  if (personalization === undefined || personalization.size === 0) {
    // Uniform distribution
    const p = 1 / nodes.length;
    return new Map(nodes.map(n => [n, p]));
  }

  // Normalize seed weights — only nodes in graph are included
  let total = 0;
  for (const node of nodes) {
    total += personalization.get(node) ?? 0;
  }

  if (total === 0) {
    // Caller provided weights for nodes not in graph — fall back to uniform
    const p = 1 / nodes.length;
    return new Map(nodes.map(n => [n, p]));
  }

  return new Map(nodes.map(n => [n, (personalization.get(n) ?? 0) / total]));
}
```

### Pattern 5: Token-Budgeted Tree Renderer

**What:** Sort files by PageRank score descending, then greedily render a hierarchical directory tree until the token budget is exhausted. The token approximation is `Math.ceil(charCount / 3)`.

**Why 3 chars/token for code:** Code is denser than prose (shorter tokens: keywords, operators, identifiers). The spec mandates this approximation. English prose is ~4 chars/token. Code at ~3 chars/token is the established approximation for mixed code contexts. (Source: REND-02 requirement)

```typescript
// src/renderer/tree.ts
interface TreeRendererOptions {
  readonly tokenBudget: number;  // default 2048
  readonly charsPerToken: number; // default 3
}

function renderTree(
  graph: FileGraph,
  scores: ReadonlyMap<string, number>,
  rootDir: string,
  options: TreeRendererOptions,
): string {
  const charBudget = options.tokenBudget * options.charsPerToken;

  // Sort files by score descending
  const ranked = Array.from(graph.files)
    .sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));

  const lines: string[] = [];
  let totalChars = 0;

  for (const filePath of ranked) {
    const relativePath = path.relative(rootDir, filePath);
    const score = scores.get(filePath) ?? 0;
    const defs = graph.definitions.get(filePath) ?? [];

    // Build file header line
    const fileHeader = `${relativePath} [score: ${score.toFixed(4)}]`;

    // Build definition lines
    const defLines = defs
      .filter(n => !['import', 'export'].includes(n.kind))
      .map(n => `  ${n.kind} ${n.name} (L${n.startLine})`);

    const block = [fileHeader, ...defLines, ''].join('\n');

    if (totalChars + block.length > charBudget) break;
    lines.push(block);
    totalChars += block.length;
  }

  const tokenCount = Math.ceil(totalChars / options.charsPerToken);
  lines.push(`[~${tokenCount} tokens]`);

  return lines.join('\n');
}
```

### Pattern 6: Filesystem Cache (INFRA-03)

**What:** Serialize the parsed graph and scores to `.graft/cache.json`. On next run, compare each file's `mtime + size` fingerprint. Serve cache only if ALL fingerprints match. Never silently serve stale cache.

**Fingerprint strategy:** `fs.stat()` returns `mtimeMs` (milliseconds) and `size` (bytes). Concatenate as `"${mtimeMs}:${size}"`. This is identical to what webpack, Makefile, and most build tools use — no crypto hashing required.

```typescript
// src/cache/index.ts
interface FileFingerprint {
  readonly mtimeMs: number;
  readonly size: number;
}

interface CacheEntry {
  readonly version: number;  // bump to invalidate all caches on schema change
  readonly rootDir: string;
  readonly createdAt: string;
  readonly fingerprints: Record<string, FileFingerprint>;  // filePath → fingerprint
  readonly parseResults: readonly ParseResult[];
}

const CACHE_VERSION = 1;
const CACHE_PATH_SUFFIX = '.graft/cache.json';

async function computeFingerprint(filePath: string): Promise<FileFingerprint> {
  const stat = await fs.stat(filePath);
  return { mtimeMs: stat.mtimeMs, size: stat.size };
}

async function isCacheValid(
  cached: CacheEntry,
  currentFiles: readonly string[],
): Promise<boolean> {
  if (cached.version !== CACHE_VERSION) return false;
  if (currentFiles.length !== Object.keys(cached.fingerprints).length) return false;

  for (const filePath of currentFiles) {
    const cachedFp = cached.fingerprints[filePath];
    if (cachedFp === undefined) return false;

    const currentFp = await computeFingerprint(filePath);
    if (currentFp.mtimeMs !== cachedFp.mtimeMs || currentFp.size !== cachedFp.size) {
      return false;
    }
  }
  return true;
}
```

### Anti-Patterns to Avoid

- **Edge direction inversion:** Do NOT build `importedBy` as the forward edge. Files that ARE imported by many others (high in-degree on the "imported-by" direction) should rank high. PageRank on the graph-as-drawn (A imports B means edge A→B) naturally gives higher rank to B (the library), not A (the entry point). This is the correct behavior.
- **Single score=1.0 dangling node:** If a file has no outgoing edges AND no incoming edges (fully isolated), its rank after convergence should be `(1-alpha)/N` not 1.0. Always redistribute dangling rank across ALL nodes, not accumulate in the dangling node.
- **Blocking cache reads:** Cache file read and write must be `async` using `fs/promises` — synchronous `fs.readFileSync` blocks the event loop on large repos.
- **Content-hashing for cache invalidation:** Reading every file's content to compute MD5 defeats the cache's purpose (same I/O cost as re-parsing). Use mtime+size only.
- **Storing absolute paths in cache:** Cache entries with absolute `filePath` keys break when the project is moved between machines. Consider storing relative paths in the cache JSON and resolving on load.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File stat for fingerprint | Custom inotify/kqueue watcher | `fs.promises.stat()` | Already in Node.js std lib; mtime+size is sufficient |
| JSON serialization | Custom binary format | `JSON.stringify` / `JSON.parse` | Cache volume is small (<<1MB for most repos); JSON is debuggable |
| Directory tree grouping | Trie data structure | `path.dirname()` + sort by path | String sort on absolute paths groups siblings automatically |
| Transitive closure | Floyd-Warshall matrix | BFS over `reverseEdges` | Graph is sparse; BFS is O(V+E), Floyd-Warshall is O(V³) |
| Token counting | Full tokenizer (tiktoken) | `Math.ceil(chars / 3)` | Spec mandates this approximation; adding tokenizer breaks zero-config |

**Key insight:** The algorithms in this phase are the kind that look simple but have important invariant violations if implemented carelessly (dangling nodes in PageRank, import resolution to wrong files, stale cache served silently). All three problems have well-understood solutions. Don't deviate from the established patterns.

---

## Common Pitfalls

### Pitfall 1: Import Path Resolution Mismatch
**What goes wrong:** CodeNode.references contains relative strings like `'../utils'` or `'.models'`. These are NOT absolute paths. If the graph builder uses them as-is as edge targets, no edges are ever found (because `files` contains absolute paths), producing a disconnected graph where every file has score ~`(1-alpha)/N`.
**Why it happens:** Parser emits module references as the raw import string, not resolved paths.
**How to avoid:** Implement `resolveImportPath()` (Pattern 2 above) that applies `path.resolve(importerDir, ref)` then tries extensions `.ts`, `.tsx`, `.js`, `.py` and `/index.ts` variants.
**Warning signs:** All PageRank scores equal or near `(1-alpha)/N ≈ 0.022`. No file in `forwardEdges` has any edges.

### Pitfall 2: Dangling Node Rank Monopolization
**What goes wrong:** A file with no outgoing edges accumulates PageRank from inbound links but cannot distribute it outward. After convergence, this file has score ~1.0 while all others approach 0.
**Why it happens:** Power iteration without dangling node redistribution creates an absorbing Markov state.
**How to avoid:** In each iteration, sum scores of all dangling nodes (`danglingSum`) and distribute it proportionally to the teleport vector (uniformly by default). See Pattern 3's iteration formula.
**Warning signs:** One file with score > 0.5, all others < 0.01; `danglingSum` grows iteration over iteration instead of remaining stable.

### Pitfall 3: Python Relative Import Resolution
**What goes wrong:** Python relative imports like `.models` or `..core` don't resolve correctly because the raw reference string includes the dots but Python package resolution requires understanding the package hierarchy.
**Why it happens:** Python relative imports count parent directories from the current package. `from .models import User` in `src/api/views.py` should resolve to `src/api/models.py`.
**How to avoid:** For Python files, strip leading dots to count levels, then resolve from the importer's directory upward by that many levels. One dot = same directory. Two dots = parent directory.
**Warning signs:** Python files show no cross-file edges in the graph even though they clearly import from sibling modules.

### Pitfall 4: Cache Roundtrip Breaks TypeScript Types
**What goes wrong:** `ParseResult` and `CodeNode` objects contain `readonly string[]` and `readonly` properties. When deserialized from JSON, TypeScript types are satisfied structurally but the `readonly` constraint is bypassed. If downstream code is written assuming immutability, this is fine; if it relies on class instance methods, it will fail.
**Why it happens:** JSON.parse returns plain objects, not class instances.
**How to avoid:** `CodeNode` and `ParseResult` are plain interfaces (not classes) — confirmed in `src/parser/types.ts`. JSON roundtrip is safe as long as cache schema matches the current interface shapes. Add a `CACHE_VERSION` constant (start at 1) and bump it whenever either interface changes.
**Warning signs:** TypeScript errors on cache read that don't appear on fresh parse; cache version mismatch causing silent wrong types.

### Pitfall 5: Token Budget Off-by-One
**What goes wrong:** Renderer includes a file block that pushes the output over budget.
**Why it happens:** "Stop when budget exceeded" is ambiguous — does the last block that fits get included?
**How to avoid:** Include the block if adding it would NOT exceed the budget. Exclude it if it would. Use `if (totalChars + block.length > charBudget) break;` (stop before adding the block, not after).
**Warning signs:** Rendered output consistently ~1 block over budget; token count footer shows higher-than-expected value.

### Pitfall 6: Scores Not Normalized After Personalized PageRank
**What goes wrong:** Personalized PageRank scores for different queries are not comparable (a highly boosted seed node in one query might have score 0.4, while baseline uniform gives it 0.05). Comparing scores across queries leads to wrong ordering.
**Why it happens:** This is expected behavior — personalized scores ARE query-relative by design.
**How to avoid:** Document that personalized scores are only meaningful within a single query. The planner and MCP tools in Phase 3 must not persist or compare personalized scores across queries. Standard (uniform) PageRank scores are the stable baseline stored in cache.

---

## Code Examples

### Graph Construction (Verified Pattern)

```typescript
// Minimal graph builder — confirmed against CodeNode type in src/parser/types.ts
function buildGraph(results: readonly ParseResult[]): FileGraph {
  const files = new Set<string>(results.map(r => r.filePath));
  const forwardEdges = new Map<string, Set<string>>(
    results.map(r => [r.filePath, new Set<string>()])
  );
  const reverseEdges = new Map<string, Set<string>>(
    results.map(r => [r.filePath, new Set<string>()])
  );
  const definitions = new Map<string, readonly CodeNode[]>(
    results.map(r => [r.filePath, r.nodes])
  );

  for (const result of results) {
    for (const node of result.nodes) {
      if (node.kind !== 'import' && node.kind !== 'export') continue;
      for (const ref of node.references) {
        const resolved = resolveImportPath(result.filePath, ref, files);
        if (resolved === null) continue;
        forwardEdges.get(result.filePath)?.add(resolved);
        reverseEdges.get(resolved)?.add(result.filePath);
      }
    }
  }

  return { files, forwardEdges, reverseEdges, definitions };
}
```

### Convergence Check Pattern

```typescript
// Verify no file monopolizes rank — assertion usable in tests
function assertConverged(scores: Map<string, number>): void {
  const values = Array.from(scores.values());
  const max = Math.max(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  // Sum should be ~1.0 (may drift slightly due to floating point)
  if (Math.abs(sum - 1.0) > 0.01) throw new Error(`Rank sum=${sum}, expected ~1.0`);
  // No single file should monopolize rank (>0.9 is a red flag)
  if (max > 0.9) throw new Error(`Max rank=${max} — dangling node likely not handled`);
}
```

### Transitive Closure BFS

```typescript
// GRAPH-06: what files are transitively affected if filePath changes?
function transitiveClosure(
  graph: FileGraph,
  startFilePath: string,
): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [startFilePath];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const dependents = graph.reverseEdges.get(current) ?? new Set();
    for (const dep of dependents) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }

  visited.delete(startFilePath); // exclude the starting file itself
  return visited;
}
```

### Cache Write/Read

```typescript
// src/cache/index.ts — write (async, fs/promises only)
async function writeCache(
  rootDir: string,
  results: readonly ParseResult[],
): Promise<void> {
  const cacheDir = path.join(rootDir, '.graft');
  await fs.mkdir(cacheDir, { recursive: true });

  const fingerprints: Record<string, FileFingerprint> = {};
  for (const result of results) {
    fingerprints[result.filePath] = await computeFingerprint(result.filePath);
  }

  const entry: CacheEntry = {
    version: CACHE_VERSION,
    rootDir,
    createdAt: new Date().toISOString(),
    fingerprints,
    parseResults: results,
  };

  await fs.writeFile(
    path.join(cacheDir, 'cache.json'),
    JSON.stringify(entry, null, 2),
    'utf-8',
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global PageRank (uniform teleport) | Personalized PageRank (seed weights) | Standard since Brin/Page 2003 paper; widely implemented | Enables query-relevance ranking — same graph, different entry weights per query |
| Content-hash cache invalidation | mtime + size fingerprint | Established practice (Make, webpack) | Eliminates I/O cost of reading file content just to check if it changed |
| Synchronous file I/O in Node.js | `fs/promises` async everywhere | Node.js 10+ | Required — blocking I/O freezes event loop on large repos |

**Deprecated/outdated patterns to avoid:**
- `fs.readFileSync` / `fs.writeFileSync` for cache: blocks event loop, breaks concurrent usage
- Floating-point comparison without tolerance: `score === 0.022` will fail due to floating point; use `Math.abs(score - expected) < 1e-10`
- Storing scores as integers / fixed-point: PageRank values are floats in `(0, 1)`; use `number` type, 4-6 decimal places in output

---

## Open Questions

1. **Import path resolution for TypeScript path aliases**
   - What we know: CodeNode.references contains raw import strings. Project's tsconfig uses `"module": "Node16"` with no path aliases defined.
   - What's unclear: If users of `graft` run it on a project with `tsconfig.json` `paths` aliases (e.g., `@/utils`), those imports won't resolve to absolute paths and edges will be silently dropped.
   - Recommendation: For v1, only resolve relative imports (starting with `.`). Absolute imports (npm packages, `@/*` aliases) are silently dropped. Document this in Phase 3 CLI stats output as "N unresolved imports skipped."

2. **Python `__init__.py` barrel edge direction**
   - What we know: Phase 1 decision: Python `__init__.py` relative imports emit as `'export'` kind to model barrel file semantics.
   - What's unclear: The graph builder needs to handle `kind === 'export'` nodes the same as `kind === 'import'` nodes when building edges (both carry references that represent dependencies). Confirm that `export` nodes' `references` array contains the upstream file paths (not the downstream importers).
   - Recommendation: Treat `kind === 'import' || kind === 'export'` identically in edge building. Verify with a test fixture.

3. **Token budget for deeply nested definitions**
   - What we know: REND-02 mandates 2048-token default, ~3 chars/token.
   - What's unclear: Should the renderer include ALL definitions for a file if it includes the file, or should it truncate definitions mid-file if adding all definitions would exceed budget?
   - Recommendation: Include all definitions for a file or none (atomic file blocks). Do not split mid-file. This keeps the tree coherent and avoids partial information being worse than no information.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `/Users/amaarchughtai/Developer/projects/graft/vitest.config.ts` (exists) |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test:coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAPH-01 | buildGraph() produces correct forward + reverse edges | unit | `pnpm test tests/graph/graph.test.ts` | ❌ Wave 0 |
| GRAPH-02 | PageRank converges; scores sum to ~1.0; no monopolization | unit | `pnpm test tests/graph/pagerank.test.ts` | ❌ Wave 0 |
| GRAPH-03 | Personalized PageRank boosts seed nodes and their dependencies | unit | `pnpm test tests/graph/pagerank.test.ts` | ❌ Wave 0 |
| GRAPH-04 | forwardDeps(file) returns correct direct dependencies | unit | `pnpm test tests/graph/traversal.test.ts` | ❌ Wave 0 |
| GRAPH-05 | reverseDeps(file) returns correct direct dependents | unit | `pnpm test tests/graph/traversal.test.ts` | ❌ Wave 0 |
| GRAPH-06 | transitiveClosure(file) returns full BFS set of affected files | unit | `pnpm test tests/graph/traversal.test.ts` | ❌ Wave 0 |
| REND-01 | Tree renders files sorted by score descending with definitions | unit | `pnpm test tests/renderer/tree.test.ts` | ❌ Wave 0 |
| REND-02 | Tree output fits within token budget (charCount / 3 <= budget) | unit | `pnpm test tests/renderer/tree.test.ts` | ❌ Wave 0 |
| REND-03 | Highest-ranked files appear first; greedy fill stops at budget | unit | `pnpm test tests/renderer/tree.test.ts` | ❌ Wave 0 |
| REND-04 | JSON output contains graph structure, scores, and metadata fields | unit | `pnpm test tests/renderer/json.test.ts` | ❌ Wave 0 |
| REND-05 | Token count footer appears in all rendered output | unit | `pnpm test tests/renderer/tree.test.ts` + `tests/renderer/json.test.ts` | ❌ Wave 0 |
| INFRA-03 | Cache write/read roundtrip; stale file invalidates cache; version mismatch invalidates cache | unit | `pnpm test tests/cache/cache.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test` (full Vitest run, ~5s on this codebase)
- **Per wave merge:** `pnpm test:coverage` (includes coverage thresholds)
- **Phase gate:** Full suite green + coverage thresholds met before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/graph/graph.test.ts` — covers GRAPH-01 (buildGraph with fixture ParseResults)
- [ ] `tests/graph/pagerank.test.ts` — covers GRAPH-02, GRAPH-03 (convergence, no monopolization, personalization)
- [ ] `tests/graph/traversal.test.ts` — covers GRAPH-04, GRAPH-05, GRAPH-06
- [ ] `tests/renderer/tree.test.ts` — covers REND-01, REND-02, REND-03, REND-05
- [ ] `tests/renderer/json.test.ts` — covers REND-04, REND-05
- [ ] `tests/cache/cache.test.ts` — covers INFRA-03

All new files — existing infrastructure covers nothing in Phase 2 yet. No shared fixture changes needed; tests can construct `ParseResult` objects inline.

---

## Sources

### Primary (HIGH confidence)
- NetworkX PageRank documentation (networkx.org) — convergence criteria, personalization vector API, dangling node parameter semantics
- graphology source code (github.com/graphology/graphology) — confirmed no personalization vector in PageRank implementation
- ngraph.pagerank README (github.com/anvaka/ngraph.pagerank) — confirmed no personalization vector; listed as future TODO

### Secondary (MEDIUM confidence)
- "Handling Dangling Nodes — PageRank" (medium.com/@arpanspeaks) — dangling redistribution formula `PR(v) = alpha * (...linkRank + danglingSum/N) + (1-alpha)/N`
- "PageRank Explained" (hippocampus-garden.com) — power iteration convergence behavior for alpha=0.85 (50-100 iterations)
- OpenAI token docs — "one token is roughly 4 characters" for English prose; code is denser (~3 chars/token corroborated by tokenx library defaulting to 6 chars/token for non-English/code)
- tokenx library (github.com/johannschopplich/tokenx) — heuristic token estimator confirming 4-6 chars/token range

### Tertiary (LOW confidence — needs validation in implementation)
- Import path resolution extension order (`.ts` before `.js`) — inferred from Node.js ESM/CJS module resolution docs; not verified against real edge cases in the codebase
- Python relative import level counting approach — inferred from Python language spec; needs a test fixture with real relative imports to confirm correctness

---

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps): HIGH — confirmed by library investigation; all required algorithms are hand-rollable in ~200 lines
- Architecture (FileGraph, PageRank, renderer): HIGH — patterns match established implementations (NetworkX, webpack cache, tree-sitter patterns from Phase 1)
- Algorithm correctness (PageRank iteration formula): HIGH — cross-referenced with NetworkX docs, academic dangling-node treatment paper, and medium article
- Import resolution: MEDIUM — relative import resolution is straightforward; Python relative imports have one LOW-confidence detail (level counting)
- Pitfalls: HIGH — all five pitfalls are directly observable failure modes with clear detection signals

**Research date:** 2026-03-28
**Valid until:** 2026-06-28 (stable algorithms; no library versions to track since no new deps)
