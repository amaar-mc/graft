# Stack Research

**Domain:** TypeScript-based codebase context engine / code intelligence CLI + MCP server
**Researched:** 2026-03-27
**Confidence:** MEDIUM-HIGH (core framework choices HIGH; tree-sitter binding strategy MEDIUM due to active churn)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript (strict) | 5.x | Language | Non-negotiable per project constraints. `strict: true` catches the class of errors that bite you hardest in graph/AST code (null derefs, bad casts). |
| Node.js | 18 LTS minimum | Runtime | LTS guarantees; native `fs.readFile` async is fine for local-first file I/O. Bun is preferred for speed per global preferences but Node 18 is the portability floor for `npx graft` users. |
| pnpm | 9.x | Package manager | Non-negotiable per project constraints. Faster installs, strict dependency hoisting prevents phantom deps. |
| tsup | 8.5.0 | Build/bundler | Standard for TypeScript CLI packages in 2025; wraps esbuild, emits CJS+ESM, handles type declarations, zero config. 1M+ weekly downloads. |
| Vitest | 4.x | Test runner | Native ESM + TypeScript, Jest-compatible API, snapshot testing built-in, fast. Replaces Jest for modern TS projects. Required per project constraints. |

### Parsing Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `tree-sitter` (node bindings) | 0.22.x | AST parser — native path | Native N-API bindings are 3-5x faster than WASM in Node.js. Ships prebuilt binaries via `prebuildify` + `node-gyp-build`, so `npm install` works without compiler for Node 18/20/22 on x64/arm64 on macOS/Linux/Windows. Use as primary binding. |
| `web-tree-sitter` | 0.25.x | AST parser — WASM fallback | Pure-JS WASM; no native compilation required. Slower but universally portable. Known TypeScript types regression in 0.25.0-0.25.1 was fixed in #4185 (merged Feb 2025). Pin to 0.25.3+ to avoid the types bug. Use as fallback when native bindings fail to build. |
| `tree-sitter-typescript` | 0.25.x | TypeScript/TSX grammar | Official grammar maintained by tree-sitter org. Covers both `typescript` and `tsx` dialects as separate sub-grammars. |
| `tree-sitter-javascript` | 0.23.x | JavaScript grammar | Official grammar; covers `.js`, `.mjs`, `.cjs`. Needed alongside TypeScript grammar since `.js` files are valid in TS projects. |
| `tree-sitter-python` | 0.25.x | Python grammar | Official grammar. v1 language target per project spec. |

**Binding strategy decision:** Use native `tree-sitter` as primary. Ship a runtime capability check: if `require('tree-sitter')` throws (native build missing), fall back to `web-tree-sitter` + WASM blobs. This gives `npx graft` users fast parsing on common platforms while not hard-failing on exotic environments.

### MCP Server Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@modelcontextprotocol/sdk` | 1.28.x | MCP server implementation | Official Anthropic SDK (36K+ dependents). Provides `McpServer`, `StdioServerTransport`, typed tool/resource definitions. v1.x is production-stable; v2 is pre-alpha targeting Q1 2026 — do not adopt v2 for this project. Import from `@modelcontextprotocol/sdk/server/mcp.js` and `@modelcontextprotocol/sdk/server/stdio.js`. |
| `zod` | 3.25.x | Schema validation for MCP tool inputs | MCP SDK v1 uses zod v3 internally; importing zod/v4 in the same project causes `keyValidator._parse is not a function` runtime errors. Pin to `^3.25.0`, not v4. Avoid mixing v3 and v4. |

### CLI Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `commander` | 12.x | CLI argument parsing | 152M weekly downloads; smallest bundle (61KB gzipped); 85/100 health score vs Yargs 67/100. Clean TypeScript API. No startup overhead. Standard choice for TypeScript CLIs in 2025. |
| `chalk` | 4.x (NOT 5.x) | Terminal colors | Chalk 5 is ESM-only. tsup produces CJS output by default; mixing CJS host + ESM chalk causes `ERR_REQUIRE_ESM`. Chalk 4 is CJS-compatible and still widely used. If the project is configured as pure ESM (`"type":"module"` in package.json), chalk 5 is fine — but verify tsup output format first. |
| `ora` | 5.x (CJS) or 8.x (ESM) | Progress spinners | Same ESM/CJS constraint as chalk. Pin to 5.x for CJS builds; 8.x for ESM builds. Used for `graft serve` startup and indexing progress. |

**ESM vs CJS decision:** tsup can emit both. The safest path for an `npx` CLI is to emit CJS (broadest compatibility) and pin chalk@4 + ora@5. If you commit to `"type":"module"` and ESM output, you unlock chalk@5 + ora@8 but risk subtle require() interop bugs on some Node versions.

### File Discovery Layer

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fast-glob` | 3.3.3 | File pattern matching | 79M weekly downloads; used by Prettier; includes TypeScript types. Best-in-class for recursive file enumeration with glob patterns. Use for discovering source files in a repo. |
| `ignore` | 6.x | .gitignore rule parsing | Used by eslint + prettier; pure JS implementation of the .gitignore spec 2.22.1. Parse `.gitignore` files and filter discovered paths. Do not reimplement gitignore logic. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint 9.x | Linting | Use flat config (`eslint.config.ts`). Enforce `no-any`, no `as` casts, explicit return types. |
| Prettier 3.x | Formatting | Non-negotiable per global code standards. |
| `@vitest/coverage-v8` | Code coverage | V8-based coverage with AST remapping (Vitest 3.2+). Target >90% on core modules per project spec. |
| `@modelcontextprotocol/inspector` | MCP debugging | Run via `npx @modelcontextprotocol/inspector` — visual debugger showing every JSON-RPC message. Critical for MCP tool development. |

## Installation

```bash
# Core runtime
pnpm add tree-sitter tree-sitter-typescript tree-sitter-javascript tree-sitter-python
pnpm add web-tree-sitter
pnpm add @modelcontextprotocol/sdk zod@^3.25.0
pnpm add commander chalk@^4 ora@^5
pnpm add fast-glob ignore

# Dev dependencies
pnpm add -D typescript tsup vitest @vitest/coverage-v8
pnpm add -D eslint prettier
pnpm add -D @types/node
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `tree-sitter` (native) | `web-tree-sitter` (WASM only) | If targeting browser environments or WASM-only runtimes where native compilation is impossible. For a local CLI, native is always better. |
| `tree-sitter` (native) | `@ast-grep/napi` | ast-grep has better structural search syntax but is a higher-level abstraction. Use if search is the primary feature, not graph construction. |
| `commander` | `yargs` | Yargs if you need built-in argument validation, type coercion, and middleware pipeline. Commander is simpler and lighter for subcommand CLIs. |
| `commander` | `oclif` (Salesforce) | oclif if building a large plugin-based CLI framework (like Heroku CLI). Overkill for graft; adds 70-100ms startup vs Commander's near-zero. |
| `fast-glob` | `globby` | globby adds git-aware filtering and stream support on top of fast-glob. Only needed if you want to replace fast-glob + ignore with a single package. |
| `zod` v3 | `zod` v4 | Zod v4 is 10x faster at compile time and has cleaner generics. Migrate after MCP SDK v2 ships with explicit v4 support. v4 is not safe today with MCP SDK v1. |
| `chalk` v4 | `kleur` | kleur has zero dependencies and is slightly smaller. Use if binary size is critical. chalk@4 is more widely known and better supported by ora. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `chalk@5` with CJS output | ESM-only; causes `ERR_REQUIRE_ESM` when required in CJS bundles. A common pitfall that breaks `npx graft` silently in some environments. | `chalk@4` (CJS) or commit fully to ESM output from tsup |
| `zod@4` with MCP SDK v1 | Type incompatibility: `ZodType` v3 and v4 are not interchangeable. Causes runtime crash: `keyValidator._parse is not a function`. Open issue in MCP SDK repo. | `zod@^3.25.0` until MCP SDK v2 ships |
| `@babel/parser` or `acorn` | Lower-fidelity ASTs than tree-sitter; no multi-language support; no incremental parsing. Wrong tool for a codebase intelligence engine. | `tree-sitter` |
| `typescript` compiler API (`ts.createSourceFile`) | Only works for TypeScript/JavaScript; separate code path from Python; heavy startup cost; no query system. | `tree-sitter` with typed grammars |
| External database (SQLite, PostgreSQL, Redis) | Violates project constraint: zero external dependencies, zero config. Adds installation friction that defeats `npx graft`. | In-memory graph + `.graft/cache.json` serialization |
| `tiktoken` for token counting | Unnecessary dependency for ~10% accuracy target. Adds ~5MB to install. | 4-chars-per-token approximation (project-specified) |
| `jest` | Slower than Vitest for ESM/TypeScript; requires more config; project spec mandates Vitest. | `vitest` |
| `webpack` or `rollup` for bundling | tsup (wraps esbuild) is faster, zero-config, and purpose-built for TypeScript library/CLI bundles. | `tsup` |

## Stack Patterns by Variant

**If emitting ESM output from tsup:**
- Use `chalk@5` and `ora@8` (both ESM-native)
- Set `"type": "module"` in package.json
- Set `module: NodeNext` + `moduleResolution: NodeNext` in tsconfig
- Be aware: some older MCP clients may have issues with ESM-only servers (verify)

**If emitting CJS output from tsup (recommended for maximum `npx` compatibility):**
- Use `chalk@4` and `ora@5`
- Standard `module: CommonJS` or `module: Node16` in tsconfig
- Broadest compatibility across Node 18/20/22 and all MCP clients

**If native tree-sitter binding fails to build:**
- Fall back to `web-tree-sitter` with bundled WASM
- Detect at runtime: `try { require('tree-sitter') } catch { useWasm() }`
- WASM blobs for each language grammar must be bundled or fetched at first run

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@modelcontextprotocol/sdk@1.28.x` | `zod@^3.25.0` | SDK imports `zod/v4` internally but maintains v3 compatibility at 3.25+. Do NOT upgrade zod to v4 independently. |
| `tree-sitter@0.22.x` | `tree-sitter-typescript@0.25.x` | Grammar versions must be aligned with tree-sitter core. Mismatched versions cause "incompatible language version" warning and degraded parsing. |
| `chalk@4.x` | `ora@5.x` | Both CJS; designed to work together. This is the documented usage pattern in ora's README. |
| `tsup@8.5.x` | `typescript@5.x` | tsup 8.x requires TypeScript 5.x. |
| `vitest@4.x` | `typescript@5.x` | Vitest 4.x requires Node 18+; compatible with TypeScript 5. |

## Sources

- [web-tree-sitter npm](https://www.npmjs.com/package/web-tree-sitter) — version, WASM binding details
- [tree-sitter/tree-sitter GitHub issue #4187](https://github.com/tree-sitter/tree-sitter/issues/4187) — TypeScript types fix in 0.25.x (MEDIUM confidence: fix merged but npm release timing unclear)
- [tree-sitter/node-tree-sitter GitHub](https://github.com/tree-sitter/node-tree-sitter) — v0.22.4 current, node-gyp + prebuildify approach (HIGH confidence)
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — v1.28.0 current, 36K dependents (HIGH confidence)
- [MCP SDK GitHub — v2 pre-alpha notice](https://github.com/modelcontextprotocol/typescript-sdk) — v1.x recommended for production (HIGH confidence)
- [MCP SDK zod compatibility issue #906](https://github.com/modelcontextprotocol/typescript-sdk/issues/906) — zod v3 vs v4 runtime crash (HIGH confidence: active open issue)
- [tsup npm](https://www.npmjs.com/package/tsup) — v8.5.0, 1M+ weekly downloads (HIGH confidence)
- [vitest npm](https://www.npmjs.com/package/vitest) — v4.1.2 current (HIGH confidence)
- [commander vs yargs comparison](https://www.pkgpulse.com/compare/commander-vs-yargs) — download counts, health scores (MEDIUM confidence: third-party analysis)
- [fast-glob npm](https://www.npmjs.com/package/fast-glob) — v3.3.3, 79M weekly downloads (HIGH confidence)
- [chalk ESM issue](https://github.com/microsoft/TypeScript/issues/46930) — chalk@5 ESM-only breaking CJS TypeScript builds (HIGH confidence: filed against TypeScript repo)
- [Pulsar blog: Modern Tree-sitter part 7](https://blog.pulsar-edit.dev/posts/20240902-savetheclocktower-modern-tree-sitter-part-7/) — WASM vs native performance tradeoffs (MEDIUM confidence: editor-specific context)

---
*Stack research for: Graft — codebase context engine (TypeScript CLI + MCP server)*
*Researched: 2026-03-27*
