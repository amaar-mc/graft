# Pitfalls Research

**Domain:** Codebase context engine / MCP developer tool (tree-sitter parsing, graph ranking, token-budgeted rendering)
**Researched:** 2026-03-27
**Confidence:** HIGH (critical pitfalls verified via official docs, GitHub issues, and production post-mortems)

---

## Critical Pitfalls

### Pitfall 1: stdout Contamination Silently Corrupts MCP stdio Transport

**What goes wrong:**
Any `console.log()`, `process.stdout.write()`, or third-party library that writes to stdout crashes the MCP session with a JSON parse error. The host application (Claude Code, Cursor, etc.) receives mangled JSON-RPC and the session dies — often with an opaque "SyntaxError: Unexpected token S at position 0" error that implicates the client, not Graft.

**Why it happens:**
MCP's stdio transport uses stdout as the exclusive JSON-RPC channel. Developers add debug logging during development and forget it, or pull in a dependency that emits startup banners to stdout. The failure mode is total and immediate, but the error appears to come from the MCP client rather than the server.

**How to avoid:**
Route all logging to stderr exclusively from day one. Set up a lightweight logger wrapper (`logger.ts`) at project start that hard-codes to `process.stderr`. Run ESLint with a rule (`no-console`) that disallows bare `console.log` in any file under `src/server/`. Audit every dependency for stdout writes during startup.

**Warning signs:**
- MCP client reports "invalid JSON" or "connection closed unexpectedly" immediately after `graft serve`
- Works in `graft map` (CLI, stdout intentional) but fails in `graft serve`
- Adding `--verbose` to the client reveals a partial message like `Initializing parser...{...}`

**Phase to address:**
Phase that implements the MCP server (likely Phase 4). The logger utility should be built in Phase 1 before any output is written, treating it as foundational infrastructure.

---

### Pitfall 2: WASM/Native Tree-Sitter Binding Version Lock-in Causes Breakage at Install Time

**What goes wrong:**
`web-tree-sitter@0.26.x` is incompatible with `.wasm` grammar files built against `tree-sitter-cli@0.20.x`. The binding and language grammar `.wasm` files must be version-matched. When a user installs via `npx graft`, mismatched versions produce silent parse failures or hard crashes rather than a clear "incompatible grammar" error. The WASM file path also defaults to the script's current directory — in bundled or transpiled output (tsup), this path is wrong unless explicitly configured via `locateFile`.

**Why it happens:**
tree-sitter releases the runtime (`web-tree-sitter`) and the grammar CLI (`tree-sitter-cli`) on separate version tracks. Newer emscripten toolchain requirements mean `.wasm` files are not backward-compatible. Because this is a packaging concern, not a runtime concern, it surfaces only when end users install — not during local development where versions are pinned.

**How to avoid:**
Pin `web-tree-sitter` and all `tree-sitter-{language}` grammar packages to a known-compatible version set. Vendor the pre-built `.wasm` files in `src/assets/` rather than relying on the grammar packages' postinstall. Pass an explicit `locateFile` callback to `Parser.init()` that resolves paths relative to `__dirname` in the compiled output. Write an integration test that runs `Parser.init()` and parses a minimal fixture — this test will catch version drift in CI before it reaches users.

**Warning signs:**
- `Language.load()` throws or returns null after updating any tree-sitter-related package
- Parse results return empty or malformed trees without throwing
- Works locally but fails after `npm pack` and local install test

**Phase to address:**
Phase 1 (parser foundation). The WASM loading strategy must be established before any parsing logic is built on top of it.

---

### Pitfall 3: Dangling Nodes and Disconnected Subgraphs Break PageRank Convergence

**What goes wrong:**
Files with no imports (entry points, standalone utilities) and files whose imports resolve to nothing (unresolved modules, missing deps) become sink nodes in the dependency graph. Sink nodes absorb rank and produce a degenerate solution where one node converges to rank 1.0 and everything else approaches 0. This makes ranking useless: a single isolated utility file scores higher than the core application module.

**Why it happens:**
Standard PageRank requires the stochastic transition matrix to be irreducible (all nodes mutually reachable). Code dependency graphs violate this by design — leaf files have no outgoing imports, and files that only import from `node_modules` (excluded from the graph) become sinks. The damping factor (0.85) partially addresses this but does not fully fix disconnected subgraphs.

**How to avoid:**
Implement the dangling-node correction: for each iteration, distribute the accumulated rank of all sink nodes uniformly across all nodes before applying the standard PageRank update. Alternatively, add a "teleportation" edge from every sink node to every other node with weight 1/N. Also prefer personalized PageRank (query-seeded weights) over global PageRank — it naturally handles disconnected components by anchoring rank flow from seed nodes. Validate with a test fixture that includes isolated files and assert they receive non-zero but appropriately low rank.

**Warning signs:**
- `graft map` consistently shows a single utility file at the top of rankings regardless of query
- PageRank scores are bimodal: one very high value and many near-zero values
- Convergence takes unusually many iterations (>200) or oscillates

**Phase to address:**
Phase 2 (graph construction and ranking). Must be correct before the rendering phase consumes rank scores.

---

### Pitfall 4: Auto-Generated and Vendored Files Poison Graph Rankings

**What goes wrong:**
Generated files (`*.generated.ts`, `dist/`, `*.pb.js` protobuf outputs, lockfiles, migration SQL) often have enormous import fan-in — many files reference them — which causes PageRank to rank them higher than actual application logic. A generated GraphQL schema or a Prisma client barrel file ends up as the "most important" file in the map. Token budget gets consumed by noise.

**Why it happens:**
`.gitignore` patterns exclude generated files from version control, but they are still present on disk at analysis time. `node_modules/` exclusion is well-known, but teams have project-specific generated directories (`__generated__`, `prisma/client`, `src/api/generated/`) that no default exclusion list covers. The graph ranker has no signal that a file's high centrality comes from generation rather than real architectural importance.

**How to avoid:**
Apply exclusions in two layers: (1) a hardcoded default set covering `node_modules`, `dist`, `build`, `.next`, `coverage`, `__pycache__`, `.venv`, `*.min.js`, `*.d.ts` (declaration files), and common generated directories; (2) respect `.gitignore` as the second layer. Additionally, detect barrel files (files whose entire content is re-exports) and apply a ranking penalty — they have structural centrality but zero semantic value to an AI context consumer. Surface excluded file counts in `graft stats` so users can see what's being filtered.

**Warning signs:**
- `graft map` output is dominated by `index.ts` barrel files or `*.d.ts` declaration files
- `prisma/generated/` or `__generated__/` directories appear in the tree output
- Token budget is consumed before any application-logic files appear

**Phase to address:**
Phase 1 (file discovery) and Phase 2 (graph construction). File exclusion logic must be in place before the graph is built.

---

### Pitfall 5: MCP Tool Schemas Consume Thousands of Tokens Before Any User Message

**What goes wrong:**
Each MCP tool's JSON schema is injected into the LLM's context on every request. Graft exposes 4+ tools (`graft_map`, `graft_context`, `graft_search`, `graft_impact`, `graft_summary`). Verbose descriptions and redundant parameter definitions can cost 550–1,400 tokens per tool — 3,000–7,000 tokens just in schema overhead before any code map is rendered. This directly consumes the budget Graft is designed to fill with code context.

**Why it happens:**
Tool descriptions are written for human readability during development, not token efficiency. Nested parameter objects, prose-style descriptions of what parameters do, and restating information in both description and schema properties all multiply token cost. The MCP spec does not enforce brevity.

**How to avoid:**
Write tool descriptions using the minimum viable prose: "Returns ranked code map within token budget. Optional: query (string) to personalize ranking, budget (number, default 2000)." Use structured JSON Schema properties (`minimum`, `maximum`, `default`, `enum`) instead of prose descriptions of constraints. Keep parameter names short (`q` instead of `query_string`, `budget` instead of `token_budget_limit`). Add a benchmark test that asserts total serialized schema size for all tools is under 4,000 characters (roughly 1,000 tokens).

**Warning signs:**
- Claude Code users report that Graft's tools appear in their token usage statistics as a significant overhead
- Tool listing (`tools/list`) response is larger than a typical `graft_map` response
- Parameter descriptions contain sentences like "This parameter allows you to..."

**Phase to address:**
Phase 4 (MCP server implementation). Schema design must be reviewed before the server is shipped; retrofitting descriptions is cheap but often skipped.

---

### Pitfall 6: Token Budget Math Uses Wrong Approximation for Code

**What goes wrong:**
The "4 chars ≈ 1 token" approximation is calibrated for English prose. Code tokenizes differently: special characters (`{`, `}`, `=>`, `::`, `//`), short identifiers, and structured formatting (JSON, YAML, indented trees) often tokenize at 2–3 chars per token, not 4. A renderer that trusts the 4-char heuristic will produce outputs that exceed the stated budget by 30–60% when the map contains dense symbol listings or JSON output. The LLM client silently truncates or the request fails.

**Why it happens:**
Avoiding the `tiktoken` dependency (correct for a minimal, local-first tool) means using a heuristic. The 4-char rule is widely cited but specifically derived from English text. Code and tree-structured output are not English text.

**How to avoid:**
Use 3 chars per token as the default approximation for mixed code/text output, and 2.5 chars per token for JSON output mode. This over-estimates token count (rendering slightly less than the budget allows), which is safe — over-truncation is recoverable, over-stuffing is not. Document the approximation and its conservative bias explicitly. Add a `--exact-tokens` flag backed by a simple unigram character-class tokenizer for users who need precision.

**Warning signs:**
- LLM clients report `graft_map` results that are noticeably longer than the configured budget
- JSON output mode consistently produces larger-than-expected responses
- Budget of 2,000 tokens produces output that tiktoken measures at 2,800–3,200 tokens

**Phase to address:**
Phase 3 (rendering). The token budget math is at the core of the renderer contract and must be calibrated before snapshot tests are written.

---

### Pitfall 7: Directed Graph Edge Direction Causes Wrong Ranking Intuition

**What goes wrong:**
When building the dependency graph, there are two valid choices for edge direction: "A imports B" means an edge A→B (caller perspective) or B→A (callee/authority perspective). PageRank measures inbound link authority. If edges point from importer to importee (A→B), then files that are imported by many others accumulate high rank — which is correct for "most used" ranking. But if edges are accidentally inverted (B→A), entry-point files that import many things score highest, which surfaces application shells over core utilities. Sourcegraph discovered a related issue: their directed graph ranked auto-generated definition-heavy files too highly and switched to undirected edges as a correction.

**Why it happens:**
The mental model of "A depends on B" suggests B is the authority, but the graph construction code may model this as B→A (pointing toward the dependency) following convention from dependency trees. This is reversed from the PageRank convention of "incoming links = importance."

**How to avoid:**
Establish an explicit convention in a code comment at the graph construction site: "Edge direction = importer → importee. PageRank flows inward — files with many incoming edges from others rank highest." Write a deterministic test: a graph where `utils.ts` is imported by 10 files and `main.ts` imports 10 files should rank `utils.ts` higher after PageRank. Verify the result matches before wiring into the renderer.

**Warning signs:**
- Entry-point `index.ts` or `main.ts` files consistently rank at the top
- Leaf utility files rank near zero despite being imported everywhere
- Reversing the edge direction in a test produces intuitive results

**Phase to address:**
Phase 2 (graph construction). The edge direction convention must be tested and locked before PageRank is tuned.

---

### Pitfall 8: Stale Cache Served After Codebase Changes

**What goes wrong:**
Graft serializes its graph to `.graft/cache.json` for fast startup. If a user runs `graft serve`, edits their codebase, then queries Graft again in the same session or a new session, they receive stale results. The AI assistant gets told about functions that no longer exist or misses newly created ones. This is worse than no cache: it produces confident-but-wrong context.

**Why it happens:**
v1 explicitly defers file watching (out of scope). But the cache, once written, becomes stale the moment any source file changes. Users naturally expect `npx graft serve` to reflect their current codebase, not the state at last index time.

**How to avoid:**
Invalidate the cache based on a lightweight content fingerprint rather than mtime: hash the sorted list of `{filepath, size, mtime}` tuples across all indexed files. If the fingerprint changes, discard the cache and re-index. This is a single fast stat-pass over the filesystem — O(N) in file count, not file content. Display the cache age prominently in `graft stats` output. Add a `--no-cache` flag for users who want guaranteed freshness. Document the limitation explicitly in `graft serve` startup output: "Indexed at [timestamp]. Run `graft serve --refresh` to re-index."

**Warning signs:**
- `graft_map` describes a function the user just deleted
- Users report Graft "doesn't see" recently created files
- `graft stats` shows an index timestamp older than the last git commit

**Phase to address:**
Phase 3 or 4 (whichever introduces the cache). The invalidation strategy must ship with the cache, not as a follow-up.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `.gitignore` exclusion list instead of parsing `.gitignore` files | Faster to build | Users with non-standard generated dirs get polluted maps; hard to extend | Never for v1 — use `ignore` npm package from day one |
| Use `any` for tree-sitter node types | Skips writing type wrappers | Type errors surface at runtime; refactoring becomes dangerous | Never — write typed wrappers for the 5-10 node kinds you actually access |
| Parse all files synchronously at startup | Simpler code | Blocks the process for 5-30 seconds on large repos; `npx graft` appears frozen | Never — use async file I/O with `Promise.all` batching from the start |
| Skip query-personalized PageRank, use global rank only | Simpler initial implementation | `graft_map` with a query returns the same result as without one; core value prop is missing | Acceptable as a first-pass if personalization is added before MCP server ships |
| Store entire file contents in the graph node | Enables rich rendering without re-reads | 500K LOC repo = ~2GB RAM; Node OOM kills the process silently | Never — store only symbol metadata; re-read file content on demand |
| Trust `web-tree-sitter` version in `package.json` without pinning grammar WASM versions | Simpler dependency management | Next `npm install` on a fresh machine may pull incompatible grammar files | Never — pin all tree-sitter-related packages together in a version-lock comment |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `web-tree-sitter` WASM initialization | Calling `new Parser()` before `await Parser.init()` completes | Await `Parser.init()` in a module-level async initializer; expose a `getParser()` factory that guards against uninitialized state |
| MCP SDK stdio transport | Using `console.log` anywhere in server code for debugging | Redirect all output to `process.stderr`; wrap in a logger that checks `process.env.GRAFT_LOG_LEVEL` |
| MCP tool responses | Returning the full file content of every matched file | Return ranked symbol metadata; let `graft://file/{path}` resource handle full content on demand |
| `.gitignore` parsing | Rolling custom glob ignore logic | Use the `ignore` npm package which correctly implements gitignore semantics including negation patterns |
| Tree-sitter TypeScript grammar | Using the `typescript` grammar for `.tsx` files | Load `tsx` grammar separately — `tree-sitter-typescript` ships two grammars: `typescript` and `tsx` |
| Cache file location | Writing `.graft/cache.json` to the user's home directory | Write to the analyzed repo's root, not CWD of the Graft process; resolve the repo root from the `--root` argument |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading a new WASM parser instance per file | `graft map` takes 30+ seconds on a 100-file repo | Create one `Parser` instance per language, reuse across all files | Immediately — even 10 files become slow |
| PageRank with no early-exit convergence check | CPU spins at 100% for 10+ seconds on medium repos | Check delta < 1e-6 after each iteration; cap at 100 iterations | ~500 nodes with no early exit |
| Synchronous recursive directory walk | Process blocks entirely on large repos; appears hung | Use async filesystem APIs (`fs.promises.readdir` with concurrency) or `fast-glob` | ~5,000 files |
| Storing full AST node objects in the graph | Memory usage grows linearly with LOC, hits Node default 1.4GB heap limit | Store only extracted metadata (name, kind, file, line, exported); discard the AST after extraction | ~200K LOC |
| Re-parsing the same file for symbol extraction and reference extraction in separate passes | 2x parse time | Combine symbol and reference extraction into a single tree traversal per file | Noticeable at ~500 files |
| Rendering full directory tree before applying token budget | Renderer builds a potentially huge string then truncates | Apply token budget greedily during tree construction, not after | Large repos where the full tree exceeds 10x the budget |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Resolving file paths from MCP tool arguments without sanitization | Path traversal: `graft://file/../../.ssh/id_rsa` | Resolve all paths relative to the indexed repo root; reject any path that resolves outside the root after `path.resolve()` |
| Logging source file content to stderr at debug level | User code leaks to stderr, which MCP clients may forward to telemetry | Log only file paths and metadata at debug level, never file contents |
| Writing cache to a world-readable temp directory | Other users on a shared machine read source code from cache | Write cache to `.graft/` inside the repo root (inherits repo permissions) |
| Executing tree-sitter queries constructed from user input | Not a concern for Graft's read-only use case, but queries accepting raw user patterns via `graft_search` could be misused if patterns are evaluated in unexpected contexts | Document that `graft_search` pattern is a literal name/glob match, not a tree-sitter query string |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent success with empty output when no files match | User thinks Graft is broken; no indication of why output is empty | Print "0 files matched — check --root or .gitignore exclusions" with actionable hints |
| `npx graft` first-run takes 10 seconds with no progress feedback | Users Ctrl-C thinking it's hung | Show a progress spinner with file count and phase ("Parsing 1,203 files...") from the first file processed |
| Token budget default too low for real repos | AI assistant asks Graft for context but the output is too truncated to be useful | Default budget of 2,000 tokens is a starting point; document clearly that users should increase for complex queries; auto-detect budget from MCP client capabilities if the spec provides it |
| `graft serve` exits when the MCP client disconnects | Users expect the server to stay alive between sessions (e.g., they restart Claude Code) | Use a keep-alive loop; reconnect on client reconnection |
| Ranking shows the same files every query regardless of the query parameter | Users realize personalization isn't working; they lose trust in the tool | Make it obvious in `graft stats` output when personalized vs. global ranking is in use; add a test that confirms two different queries produce different top-10 results |

---

## "Looks Done But Isn't" Checklist

- [ ] **WASM loading:** Parser initializes cleanly in `npx` context (bundled output, not source directory) — verify with `npm pack && cd /tmp && npx /path/to/graft.tgz map .`
- [ ] **MCP stdio safety:** Zero bytes written to stdout except JSON-RPC messages — verify with `graft serve 2>/dev/null | head -c 1000` and confirm the first byte is `{`
- [ ] **Token budget:** JSON output mode and tree output mode each produce output within 10% of configured budget — verify with `graft map --budget 1000 --format json | wc -c` and apply the char-per-token heuristic
- [ ] **Personalized ranking:** A query of "authentication" produces different top-5 files than a query of "database" — verify on a repo that has both auth and DB code
- [ ] **Sink node handling:** A repo containing files with zero imports still produces a valid ranked output (no file gets rank 1.0, no file gets rank 0.0) — verify with a minimal fixture
- [ ] **Cache invalidation:** Adding a new function to any file and re-running `graft map` (with cache present) reflects the change — verify that the cache fingerprint changes on file modification
- [ ] **tsx vs ts grammar:** `.tsx` files are parsed with the tsx grammar, not the typescript grammar — verify that JSX syntax in `.tsx` files does not produce ERROR nodes in the parse tree
- [ ] **gitignore exclusion:** `node_modules/`, `dist/`, and project-specific generated directories are absent from `graft stats` file count — verify on a repo with all three

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| stdout contamination discovered post-release | LOW | Single-commit fix: replace all `console.log` with `console.error` in server code; patch release |
| WASM version mismatch in shipped package | MEDIUM | Pin versions, rebuild grammar WASM files, republish; may require major version bump if API changed |
| Wrong PageRank edge direction ships in v1 | MEDIUM | Invert edge direction in graph builder, rerun snapshot tests, invalidate all user caches on next update |
| Token budget over-estimates ship to users | LOW | Tighten char-per-token heuristic, update snapshot tests; users get slightly less output, which is safe |
| Cache serves stale data — no invalidation shipped | HIGH | Requires adding fingerprint hashing to an existing cache schema; necessitates a cache format version bump and forced re-index for all users |
| Auto-generated files dominate map output | MEDIUM | Add exclusion rules to the default filter list; users need to clear cache and re-index |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| stdout contamination | Phase 1 (logger utility) + Phase 4 (MCP server) | Test: `graft serve 2>/dev/null` first byte is `{` |
| WASM version lock-in / path resolution | Phase 1 (parser foundation) | Test: full `npm pack + npx` install and parse cycle in CI |
| Dangling nodes / PageRank convergence failure | Phase 2 (graph + ranking) | Test: isolated-file fixture produces non-degenerate rank distribution |
| Auto-generated files in graph | Phase 1 (file discovery) | Test: fixture repo with `dist/` and `__generated__/` dirs; assert zero matches in output |
| MCP tool schema token bloat | Phase 4 (MCP server) | Test: assert total schema serialization < 4,000 chars |
| Token budget math for code vs prose | Phase 3 (renderer) | Test: benchmark `--budget 1000` output against tiktoken on representative fixture |
| Graph edge direction inversion | Phase 2 (graph construction) | Test: `utils.ts` (imported by 10) ranks above `main.ts` (imports 10) |
| Stale cache without invalidation | Phase 3 or 4 (cache introduction) | Test: modify fixture file, re-run with warm cache, assert new symbol appears |
| Barrel file / declaration file noise | Phase 2 (graph construction) | Test: `*.d.ts` and barrel re-export-only files receive ranking penalty |
| tsx/ts grammar mismatch | Phase 1 (parser) | Test: parse a `.tsx` fixture with JSX; assert zero ERROR nodes in tree |

---

## Sources

- [web-tree-sitter npm — official README, WASM path and version constraints](https://www.npmjs.com/package/web-tree-sitter)
- [tree-sitter binding_web README — locateFile, CJS vs ESM, Emscripten version constraints](https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md)
- [web-tree-sitter 0.26.x incompatible with tree-sitter-cli 0.20.x — GitHub issue #5171](https://github.com/tree-sitter/tree-sitter/issues/5171)
- [Modern Tree-sitter part 7: pain points — Pulsar editor blog, September 2024](https://blog.pulsar-edit.dev/posts/20240902-savetheclocktower-modern-tree-sitter-part-7/)
- [Building a better repository map with tree-sitter — Aider blog](https://aider.chat/2023/10/22/repomap.html)
- [Ranking in a week — Sourcegraph blog, PageRank on code graphs, directed vs undirected edge decision](https://sourcegraph.com/blog/ranking-in-a-week)
- [Handling Dangling Nodes — PageRank, sink node treatment](https://medium.com/@arpanspeaks/handling-dangling-nodes-pagerank-14c31d5b6b62)
- [Implementing MCP: Tips, Tricks and Pitfalls — Nearform, stdout/stderr, schema validation, tool overlap](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/)
- [MCP server stdio mode corrupted by stdout log messages — GitHub issue, claude-flow](https://github.com/ruvnet/claude-flow/issues/835)
- [MCP Tool Schema Bloat: The Hidden Token Tax — Layered.dev, 54,600-token schema overhead measurement](https://layered.dev/mcp-tool-schema-bloat-the-hidden-token-tax-and-how-to-fix-it/)
- [10 strategies to reduce MCP token bloat — The New Stack](https://thenewstack.io/how-to-reduce-mcp-token-bloat/)
- [Context Rot: How Increasing Input Tokens Impacts LLM Performance — Chroma research](https://research.trychroma.com/context-rot)
- [LLM Token Counts: A Practical Guide — code tokenizes at different ratios than prose](https://winder.ai/calculating-token-counts-llm-context-windows-practical-guide/)
- [Real Faults in MCP Software: a Comprehensive Taxonomy — arXiv 2603.05637](https://arxiv.org/html/2603.05637v1)
- [tree-sitter-typescript — tsx vs ts grammar separation](https://github.com/tree-sitter/tree-sitter-typescript)

---

*Pitfalls research for: codebase context engine (Graft) — tree-sitter parsing, PageRank ranking, MCP server, token-budgeted rendering*
*Researched: 2026-03-27*
