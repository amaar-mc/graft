# Phase 1: Foundation + Parser — Research

**Researched:** 2026-03-27
**Domain:** TypeScript CLI scaffolding, tree-sitter AST parsing, file discovery, project infrastructure
**Confidence:** HIGH (core toolchain confirmed via official docs and npm; tree-sitter WASM path resolution MEDIUM due to bundling complexity)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | .gitignore-aware file discovery that also skips node_modules, vendor, dist, build, .git by default | fast-glob + `ignore` npm package covers all gitignore semantics including negation patterns |
| INFRA-02 | Support custom ignore patterns via optional `.graftignore` or CLI flag | `ignore` package accepts additional patterns; same API handles `.graftignore` file reads |
| INFRA-04 | Zero-config startup — works in any directory without config files | File discovery reads from CWD; all defaults hardcoded; no config file required |
| INFRA-05 | All stdout reserved for MCP JSON-RPC when running as server; logging goes to stderr only | `logger.ts` wrapper hardcodes `process.stderr`; ESLint `no-console` rule enforces at lint time |
| INFRA-06 | Actionable error messages that tell the user what to do, not just what failed | Error class hierarchy with `.hint` field; centralized throw helpers |
| PARSE-01 | Extract definitions from TS/JS files using tree-sitter AST parsing | `tree-sitter-typescript` + `tree-sitter-javascript` official grammars with `tags.scm` capture queries |
| PARSE-02 | Extract references (import statements, symbol usages) from TS/JS files | Same `tags.scm` queries return `@reference.call` and `@reference.class` captures; import node matching is additive |
| PARSE-03 | Extract definitions and references from Python files using tree-sitter AST parsing | `tree-sitter-python` official grammar with `tags.scm` capture queries |
| PARSE-04 | Handle TypeScript-specific constructs: decorators, generics, type aliases, enums, namespaces, re-exports, barrel files | `tree-sitter-typescript` grammar covers these natively; custom query patterns needed for type alias / enum captures beyond default `tags.scm` |
| PARSE-05 | Handle Python-specific constructs: decorators, relative imports, `__init__.py` re-exports, dataclasses | `tree-sitter-python` grammar covers all; relative import nodes distinguishable by `import_from` with relative `.` prefix |
| PARSE-06 | Return structured `CodeNode` objects with id, name, kind, filePath, startLine, endLine, and references | `CodeNode` interface defined in `parser/types.ts`; built from `QueryCapture` node positions |
| QUAL-05 | Strict TypeScript — no `any`, no unsafe `as` casts, all functions have explicit return types | `tsconfig.json` with `strict: true`; `@typescript-eslint/no-explicit-any` + `@typescript-eslint/explicit-function-return-type` rules |
| QUAL-06 | ESLint + Prettier enforced, CI pipeline with GitHub Actions | ESLint 9 flat config (`eslint.config.ts`); Prettier 3.x; GitHub Actions workflow with lint + test steps |
</phase_requirements>

---

## Summary

Phase 1 is the foundation and highest-risk phase of the project. It establishes all scaffolding (TypeScript strict, tsup, Vitest, ESLint, Prettier, GitHub Actions CI) and implements the core parsing pipeline that everything downstream depends on. The phase has two parallel concerns: infrastructure plumbing and tree-sitter integration.

The infrastructure work is well-understood and low-risk. All tools are stable and well-documented. The primary decision is CJS vs ESM tsup output — CJS is the correct choice for `npx` compatibility and dictates chalk@4 and ora@5.

The tree-sitter work is the highest-variance integration point in the entire project. The native `tree-sitter` bindings (0.22.x) are fast but require N-API prebuilts that may not exist on every user's platform. The WASM fallback (`web-tree-sitter`) is universally portable but requires careful `locateFile` path resolution in bundled output — this is the known blocker flagged in STATE.md. Both binding paths must be proven working in a bundled `npm pack + npx` context before Phase 1 closes.

The `tags.scm` query approach is the correct pattern for symbol extraction. Official TypeScript, JavaScript, and Python grammars all ship `queries/tags.scm` files whose capture names (`@definition.function`, `@definition.class`, `@reference.call`, etc.) feed directly into the `CodeNode` type. The key insight is that the query runs once per file and produces all definitions and references in a single pass — combine extraction into one traversal per file.

**Primary recommendation:** Scaffold the full project first (tsconfig, tsup, Vitest, ESLint, CI), then implement the `web-tree-sitter` WASM path as the primary parser (not native-first, because it is more portable in the `npx` context), with the native bindings as the performance upgrade fallback. Validate WASM loading in a bundled context in the very first integration test.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Language | Non-negotiable per project spec; `strict: true` required |
| Node.js | 18 LTS minimum | Runtime | Portability floor for `npx graft` users |
| pnpm | 9.x | Package manager | Non-negotiable per project spec |
| tsup | 8.5.x | Build/bundler | Wraps esbuild; emits CJS+ESM+types; zero-config; auto-bangs CLI entry |
| Vitest | 4.x | Test runner | Native ESM + TypeScript; Jest-compatible API; snapshot support built-in |

### Parsing Layer
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `web-tree-sitter` | 0.25.3+ | AST parser — WASM, primary for npx portability | Universal portability; no native build required; pin to 0.25.3+ to avoid types regression |
| `tree-sitter` | 0.22.x | AST parser — native Node.js bindings, performance fallback | 3-5x faster than WASM; prebuilts for Node 18/20/22 x64/arm64 |
| `tree-sitter-typescript` | 0.25.x | TS + TSX grammars | Official grammar; ships two sub-grammars: `typescript` and `tsx` |
| `tree-sitter-javascript` | 0.23.x | JS grammar | Official grammar; needed for `.js`, `.mjs`, `.cjs` in TS projects |
| `tree-sitter-python` | 0.25.x | Python grammar | Official grammar; v1 language target |

### File Discovery Layer
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fast-glob` | 3.3.3 | Recursive file enumeration | 79M weekly downloads; used by Prettier; best-in-class async glob |
| `ignore` | 6.x | `.gitignore` rule parsing | Implements gitignore spec 2.22.1 including negation patterns; used by eslint + prettier |

### Development Tools
| Tool | Version | Purpose |
|------|---------|---------|
| ESLint | 9.x | Linting with flat config (`eslint.config.ts`) |
| `@typescript-eslint/eslint-plugin` | 8.x | TypeScript-specific rules (`no-explicit-any`, `explicit-function-return-type`) |
| Prettier | 3.x | Formatting |
| `@vitest/coverage-v8` | 4.x | V8 AST-remapped coverage (accurate + fast) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `web-tree-sitter` (primary) | native `tree-sitter` (primary) | Native is faster but needs prebuilt binaries; WASM is always portable for `npx` install target |
| `fast-glob` + `ignore` | `globby` | `globby` wraps both into one API; tradeoff is less direct control; both are fine |
| ESLint 9 flat config | ESLint 8 with `.eslintrc` | ESLint 8 is deprecated; flat config is current standard as of ESLint 9 |

### Installation
```bash
# Runtime dependencies
pnpm add web-tree-sitter tree-sitter-typescript tree-sitter-javascript tree-sitter-python
pnpm add tree-sitter  # native fallback
pnpm add fast-glob ignore

# Dev dependencies
pnpm add -D typescript tsup vitest @vitest/coverage-v8
pnpm add -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
pnpm add -D prettier @types/node
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── cli/
│   └── index.ts            # Entry point with #!/usr/bin/env node shebang
├── indexer/
│   ├── index.ts            # Indexer orchestrator
│   └── discovery.ts        # FileDiscovery — glob + gitignore filtering
├── parser/
│   ├── index.ts            # Parser — dispatches to language extractors
│   ├── types.ts            # Tag, CodeNode type definitions
│   ├── loader.ts           # WASM grammar loader + parser cache
│   └── languages/
│       ├── typescript.ts   # TS/TSX extractor
│       ├── javascript.ts   # JS extractor
│       └── python.ts       # Python extractor
└── logger.ts               # stderr-only logger (must exist before any other output code)

tests/
├── fixtures/
│   ├── typescript/         # Sample .ts/.tsx files for parser tests
│   ├── javascript/         # Sample .js files
│   └── python/             # Sample .py files
├── parser/
│   ├── typescript.test.ts
│   ├── javascript.test.ts
│   └── python.test.ts
└── indexer/
    └── discovery.test.ts
```

### Pattern 1: Logger Before Everything
**What:** Create `src/logger.ts` as the first file — a minimal wrapper that hard-codes to `process.stderr`. Never `console.log()` anywhere in non-CLI code.
**When to use:** Every log statement in parser, indexer, and future MCP code.
**Example:**
```typescript
// src/logger.ts
// Source: design decision from PITFALLS.md — stdout contamination kills MCP sessions
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const line = meta
    ? `[graft:${level}] ${message} ${JSON.stringify(meta)}`
    : `[graft:${level}] ${message}`;
  process.stderr.write(line + '\n');
}
```

### Pattern 2: WASM Grammar Loader with locateFile
**What:** Initialize `web-tree-sitter` once with an explicit `locateFile` callback that resolves WASM file paths relative to `__dirname` of the compiled output. Cache one `Parser` instance per language.
**When to use:** All parsing operations.
**Example:**
```typescript
// src/parser/loader.ts
// Source: web-tree-sitter README — locateFile is required in bundled contexts
import Parser from 'web-tree-sitter';
import path from 'path';

let initialized = false;
const parserCache = new Map<string, Parser>();

export async function initParser(): Promise<void> {
  if (initialized) return;
  await Parser.init({
    locateFile(scriptName: string): string {
      // Resolve relative to compiled output directory, not source directory
      return path.join(__dirname, scriptName);
    },
  });
  initialized = true;
}

export async function getParser(languageName: string): Promise<Parser> {
  if (parserCache.has(languageName)) return parserCache.get(languageName)!;
  await initParser();
  const parser = new Parser();
  const lang = await Parser.Language.load(
    path.join(__dirname, `tree-sitter-${languageName}.wasm`)
  );
  parser.setLanguage(lang);
  parserCache.set(languageName, parser);
  return parser;
}
```

### Pattern 3: tags.scm Query for Symbol Extraction
**What:** Use the official `tags.scm` query from each grammar repository to extract definitions and references. Run a single `query.captures(tree.rootNode)` call per file — do not make separate passes for defs vs refs.
**When to use:** All per-file parsing.

The TypeScript grammar's `tags.scm` captures:
- `@definition.function` / `@definition.method` / `@definition.class` / `@definition.interface` / `@definition.module`
- `@reference.type` / `@reference.class`
- `@name` — the name node associated with each definition/reference

The Python grammar's `tags.scm` captures:
- `@definition.class` / `@definition.function` / `@definition.constant`
- `@reference.call`
- `@name` — the name node

**Example:**
```typescript
// src/parser/languages/typescript.ts
// Source: tree-sitter code navigation docs + tree-sitter-typescript tags.scm
import Parser from 'web-tree-sitter';
import { CodeNode } from '../types.js';

const TAGS_QUERY = `
(function_signature name: (identifier) @name) @definition.function
(function_declaration name: (identifier) @name) @definition.function
(method_definition name: (property_identifier) @name) @definition.method
(class_declaration name: (type_identifier) @name) @definition.class
(interface_declaration name: (type_identifier) @name) @definition.interface
(type_alias_declaration name: (type_identifier) @name) @definition.type
(enum_declaration name: (identifier) @name) @definition.enum
(import_statement source: (string) @name) @reference.import
(call_expression function: [(identifier) @name (member_expression property: (property_identifier) @name)]) @reference.call
`;

export function extractNodes(
  tree: Parser.Tree,
  query: Parser.Query,
  filePath: string
): CodeNode[] {
  const captures = query.captures(tree.rootNode);
  const nodes: CodeNode[] = [];
  // Pair @name captures with their @definition.* / @reference.* siblings
  // captures are returned in document order; adjacent pairs share a pattern match
  // Implementation: group by match index using captures[i].name patterns
  // ...
  return nodes;
}
```

### Pattern 4: CodeNode Type Definition
**What:** The universal output contract from every language parser. Downstream components (GraphBuilder in Phase 2, Renderer in Phase 3) operate only on `CodeNode[]`, never on AST objects.
**When to use:** Always — this is the core seam.
**Example:**
```typescript
// src/parser/types.ts
export type NodeKind =
  | 'function'
  | 'method'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'module'
  | 'constant'
  | 'import';

export interface CodeNode {
  readonly id: string;           // `${filePath}:${name}:${startLine}`
  readonly name: string;
  readonly kind: NodeKind;
  readonly filePath: string;     // absolute path
  readonly startLine: number;
  readonly endLine: number;
  readonly references: readonly string[];  // names this node references
}
```

### Pattern 5: File Discovery with Gitignore
**What:** Use `fast-glob` for async recursive enumeration, then filter through the `ignore` package loaded with the repo's `.gitignore` + hardcoded defaults.
**When to use:** `FileDiscovery.discover(rootDir, extraIgnores?)` — called once per index pass.
**Example:**
```typescript
// src/indexer/discovery.ts
// Source: fast-glob + ignore npm packages
import fg from 'fast-glob';
import { createIgnore } from 'ignore';
import fs from 'fs/promises';
import path from 'path';

const DEFAULT_IGNORE = [
  'node_modules', 'dist', 'build', '.next', 'out', 'coverage',
  '__pycache__', '.venv', 'venv', '.git', 'vendor',
  '*.min.js', '*.d.ts', '*.map',
];

export async function discoverFiles(
  rootDir: string,
  extraIgnorePatterns: readonly string[] = []
): Promise<string[]> {
  const ig = createIgnore();
  ig.add(DEFAULT_IGNORE);
  ig.add(extraIgnorePatterns as string[]);

  // Load .gitignore if present
  const gitignorePath = path.join(rootDir, '.gitignore');
  const gitignoreContent = await fs.readFile(gitignorePath, 'utf8').catch(() => '');
  if (gitignoreContent) ig.add(gitignoreContent);

  // Load .graftignore if present
  const graftignorePath = path.join(rootDir, '.graftignore');
  const graftignoreContent = await fs.readFile(graftignorePath, 'utf8').catch(() => '');
  if (graftignoreContent) ig.add(graftignoreContent);

  const allFiles = await fg(['**/*.{ts,tsx,js,mjs,cjs,py}'], {
    cwd: rootDir,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
  });

  return allFiles.filter(f => {
    const relative = path.relative(rootDir, f);
    return !ig.ignores(relative);
  });
}
```

### Pattern 6: tsup Configuration for CJS CLI
**What:** tsup emits CJS output for maximum `npx` compatibility. Entry point has shebang; tsup auto-marks it executable.
**When to use:** Build configuration — set once in Phase 1.
**Example:**
```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/cli/index.ts' },
  format: ['cjs'],
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: false,
  // Copy WASM grammar files to dist/ so locateFile can resolve them
  // Use a postbuild script or assets option
});
```

### Anti-Patterns to Avoid
- **Piping tree-sitter `Tree` or `Node` objects downstream:** Destroys caching, couples all modules to tree-sitter's API. Extract to `CodeNode[]` immediately and discard the AST.
- **Creating a new `Parser` instance per file:** Catastrophically slow — WASM initialization cost per file. Use the cached `getParser()` factory.
- **Separate parse passes for defs vs refs:** Unnecessary — `query.captures(tree.rootNode)` returns both in a single traversal. Combine.
- **Using `typescript` grammar for `.tsx` files:** `.tsx` requires the `tsx` sub-grammar from `tree-sitter-typescript`. Using the wrong grammar produces ERROR nodes and silently misses JSX content.
- **Putting `.gitignore` parsing inline instead of using the `ignore` package:** The `ignore` npm package implements the gitignore spec correctly including negation (`!src/generated/`) and directory semantics. Rolling custom logic breaks on edge cases.
- **Writing `console.log()` anywhere in non-CLI code:** Contaminates stdout. Use `logger.ts` exclusively.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gitignore pattern matching | Custom glob filter logic | `ignore` npm package | Gitignore spec has 20+ edge cases: negation, directory-only patterns, anchored patterns, character classes. `ignore` implements the full spec. |
| File enumeration | Recursive `fs.readdir` loop | `fast-glob` | Handles symlinks, dotfiles, platform-specific path separators, and concurrent async reads. 79M weekly downloads. |
| AST parsing | Custom regex/string parser | `tree-sitter` + official grammars | Regex breaks on nested structures, string literals, comments. tree-sitter handles all of this with incremental parsing. |
| WASM initialization guard | Manual flag/mutex | Module-level `initialized` flag + `await initParser()` in `getParser()` | Double-initialization causes WASM ABI conflicts. The singleton pattern is the correct guard. |
| TypeScript source parsing | `ts.createSourceFile` | `tree-sitter-typescript` | TypeScript compiler API is TS-only (no Python), heavy startup, no query system, no incremental parse. Wrong tool. |

**Key insight:** Every item in this table represents a problem that looks simple (30 lines) but has unbounded edge-case complexity that surfaces in production. The npm packages exist because the problems are legitimately hard.

---

## Common Pitfalls

### Pitfall 1: WASM Grammar Version Mismatch (CRITICAL)
**What goes wrong:** `web-tree-sitter@0.26.x` runtime is incompatible with `.wasm` files built against `tree-sitter-cli@0.20.x`. The error is silent or produces empty parse results — not a clear exception.
**Why it happens:** Grammar WASM files and the runtime are on separate release tracks. `npm install` may pull incompatible versions when one package updates before the other.
**How to avoid:** Pin all tree-sitter-related packages together in `package.json`. Use `0.25.3+` for `web-tree-sitter` (fixes a known types regression in 0.25.0-0.25.1). Add a CI test that parses a 10-line TypeScript fixture and asserts the correct capture names are returned.
**Warning signs:** `Language.load()` throws or returns null; parse results have no captures; works locally but fails after fresh `npm install`.

### Pitfall 2: locateFile Path Resolution Breaks in Bundled Output
**What goes wrong:** By default, `web-tree-sitter` looks for `tree-sitter.wasm` in the same directory as the current JavaScript file. In a tsup-bundled output under `/dist/`, this is correct — but the grammar WASM files (`tree-sitter-typescript.wasm`, etc.) must also be in `/dist/`. If tsup doesn't copy them, `Language.load()` fails with a file-not-found error at runtime.
**Why it happens:** tsup bundles JavaScript but does not automatically copy arbitrary asset files from `node_modules/`. The `.wasm` files from grammar packages must be explicitly copied to `dist/`.
**How to avoid:** Add a postbuild step that copies WASM files from `node_modules/tree-sitter-*/grammar.wasm` (or wherever the grammar packages put them) to `dist/`. Verify in the `npm pack + npx` CI test that WASM files are present in the tarball.
**Warning signs:** Works with `ts-node src/cli/index.ts` but fails with `node dist/index.cjs`; `ENOENT` error mentioning `.wasm` on first parse.

### Pitfall 3: `tsx` vs `typescript` Grammar for JSX Files
**What goes wrong:** `tree-sitter-typescript` ships two grammars. Using the `typescript` grammar to parse `.tsx` files produces `ERROR` nodes around JSX syntax and silently misses all JSX-contained definitions.
**Why it happens:** JSX is not in the TypeScript grammar — it is a separate dialect with its own grammar.
**How to avoid:** Map `.tsx` → `tsx` grammar, `.ts` → `typescript` grammar. This mapping lives in `loader.ts` and must be explicit.
**Warning signs:** `.tsx` files parse without error but return zero definition captures; React component definitions are missing from `CodeNode[]`.

### Pitfall 4: stdout Contamination (CRITICAL — MCP Phase Impact)
**What goes wrong:** Any `console.log()` or direct `process.stdout.write()` in non-CLI code will corrupt the MCP stdio transport when the MCP server is added in Phase 3. The damage is done in Phase 1 — every `console.log()` placed now is a time bomb.
**Why it happens:** Developers add debug logging in parser code and forget it. The failure only surfaces in Phase 3 when the MCP server uses stdout for JSON-RPC.
**How to avoid:** Create `logger.ts` in Phase 1 as the first file. Add `no-console` ESLint rule scoped to `src/` (allow only in `src/cli/`). Never use `console.log()` in parser, indexer, or any non-CLI module.
**Warning signs:** `graft serve 2>/dev/null | head -c 5` returns anything other than `{"` — the first bytes should always be a JSON object.

### Pitfall 5: Single Parse Pass Per File Not Enforced
**What goes wrong:** Separate functions for "extract definitions" and "extract references" each create a parser and run the full tree-sitter parse on the same file. This doubles parse time and defeats the purpose of the query-based approach.
**Why it happens:** Separation of concerns taken too literally at the wrong boundary.
**How to avoid:** A single `extractCodeNodes(filePath, source, parser, query)` function runs `query.captures(rootNode)` once and returns a `CodeNode[]` that includes both definitions and references. The query itself contains both `@definition.*` and `@reference.*` patterns.

---

## Code Examples

### Verified tags.scm capture patterns (TypeScript)
```scheme
; Source: https://github.com/tree-sitter/tree-sitter-typescript (queries/tags.scm)
(function_signature name: (identifier) @name) @definition.function
(method_signature name: (property_identifier) @name) @definition.method
(abstract_method_signature name: (property_identifier) @name) @definition.method
(abstract_class_declaration name: (type_identifier) @name) @definition.class
(module name: (identifier) @name) @definition.module
(interface_declaration name: (type_identifier) @name) @definition.interface
(type_annotation (type_identifier) @name) @reference.type
(new_expression constructor: (identifier) @name) @reference.class
```

### Verified tags.scm capture patterns (Python)
```scheme
; Source: https://github.com/tree-sitter/tree-sitter-python (queries/tags.scm)
(module (expression_statement (assignment left: (identifier) @name) @definition.constant))
(class_definition name: (identifier) @name) @definition.class
(function_definition name: (identifier) @name) @definition.function
(call function: [(identifier) @name (attribute attribute: (identifier) @name)]) @reference.call
```

### Query API (native tree-sitter Node.js bindings)
```typescript
// Source: https://tree-sitter.github.io/node-tree-sitter/classes/Parser.Query.html
const parser = new Parser();
parser.setLanguage(TypeScriptLanguage);
const tree = parser.parse(sourceCode);

// Create query once and reuse — queries are immutable and thread-safe
const query = new Parser.Query(TypeScriptLanguage, TAGS_QUERY_SOURCE);
const captures: Parser.QueryCapture[] = query.captures(tree.rootNode);

// Each capture: { name: 'definition.function', node: SyntaxNode }
// node.text = the matched text, node.startPosition.row = line number (0-indexed)
for (const capture of captures) {
  console.error(capture.name, capture.node.text, capture.node.startPosition.row);
}
```

### Vitest configuration for Node.js CLI project
```typescript
// vitest.config.ts
// Source: https://vitest.dev/config/
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/cli/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
});
```

### ESLint 9 flat config for TypeScript project
```typescript
// eslint.config.ts
// Source: https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      'no-console': 'error',  // Use logger.ts instead
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
    },
  },
  {
    // CLI code is allowed to use console for user-facing output
    files: ['src/cli/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
]);
```

### GitHub Actions CI workflow
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck
      - run: pnpm run lint
      - run: pnpm run test --coverage
      - run: pnpm run build
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@babel/parser` for JS/TS AST | `tree-sitter` grammars | ~2022-2023 | Multi-language support, query system, incremental parsing |
| `ts.createSourceFile` (TypeScript compiler API) | `tree-sitter-typescript` | ~2022 | Language-agnostic approach; same query API for TS and Python |
| ESLint 8 `.eslintrc` config | ESLint 9 flat config (`eslint.config.ts`) | ESLint 9.0 (2024) | TypeScript-native config file supported as of ESLint v9.18.0 |
| Jest | Vitest | ~2022 | Native TypeScript/ESM, 10-20x faster, built-in snapshot support |
| `zod` v4 | `zod` v3.25.x (with MCP SDK v1) | Active — zod v4 released Feb 2025 | Cannot upgrade until MCP SDK v2; runtime crash on v4 |

**Deprecated/outdated:**
- `chalk@5` with CJS builds: ESM-only; use `chalk@4` for CJS tsup output
- `ora@8` with CJS builds: ESM-only; use `ora@5` for CJS tsup output
- ESLint `.eslintrc.*` files: deprecated in ESLint 9; use `eslint.config.ts`
- `web-tree-sitter@0.25.0` and `0.25.1`: known TypeScript types regression; pin to `0.25.3+`

---

## Open Questions

1. **WASM grammar file packaging strategy**
   - What we know: tsup bundles JS but not arbitrary asset files; `.wasm` files must end up in `dist/`
   - What's unclear: The exact path inside grammar packages where `.wasm` files are located varies by grammar version; `tree-sitter-typescript` may put WASM at `tree-sitter-typescript.wasm` or `grammars/typescript.wasm`
   - Recommendation: Inspect `node_modules/tree-sitter-{typescript,javascript,python}/` after install to find actual WASM paths; write a postbuild copy script; verify with `npm pack + npx` integration test before Phase 1 closes

2. **Native tree-sitter prebuilt platform availability**
   - What we know: Prebuilts exist for Node 18/20/22 on x64/arm64 macOS/Linux/Windows
   - What's unclear: Alpine Linux (musl libc) and some ARM variants may not have prebuilts, causing `node-gyp-build` to fall back to compilation — which fails without a C++ toolchain
   - Recommendation: WASM-primary strategy sidesteps this entirely; native bindings are a runtime opt-in perf upgrade, not the default path

3. **`tags.scm` completeness for TypeScript-specific constructs**
   - What we know: The official `tags.scm` covers functions, methods, classes, interfaces, modules; `@definition.type` and `@definition.enum` require custom patterns beyond the default file
   - What's unclear: Whether decorators and namespace-nested definitions are captured by default patterns or need custom patterns
   - Recommendation: Fetch the actual `tags.scm` from the installed grammar package at parse time rather than hardcoding; supplement with custom patterns for TypeScript-specific constructs (type aliases, enums, decorators) in `typescript.ts`

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` — Wave 0 gap (file does not exist yet) |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm vitest run --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARSE-01 | Extract function/class/interface defs from TypeScript file | unit | `pnpm vitest run tests/parser/typescript.test.ts -t "extracts definitions"` | ❌ Wave 0 |
| PARSE-02 | Extract import references from TypeScript file | unit | `pnpm vitest run tests/parser/typescript.test.ts -t "extracts references"` | ❌ Wave 0 |
| PARSE-03 | Extract function/class defs from Python file | unit | `pnpm vitest run tests/parser/python.test.ts -t "extracts definitions"` | ❌ Wave 0 |
| PARSE-04 | TypeScript-specific: type alias, enum, decorator, re-export captured | unit | `pnpm vitest run tests/parser/typescript.test.ts -t "TypeScript specific"` | ❌ Wave 0 |
| PARSE-05 | Python-specific: relative imports, `__init__.py` re-exports, dataclasses captured | unit | `pnpm vitest run tests/parser/python.test.ts -t "Python specific"` | ❌ Wave 0 |
| PARSE-06 | `CodeNode` shape: id, name, kind, filePath, startLine, endLine, references | unit | `pnpm vitest run tests/parser -t "CodeNode shape"` | ❌ Wave 0 |
| INFRA-01 | `node_modules/`, `dist/`, `.git/` excluded from discovery | unit | `pnpm vitest run tests/indexer/discovery.test.ts -t "default ignores"` | ❌ Wave 0 |
| INFRA-02 | `.graftignore` patterns respected | unit | `pnpm vitest run tests/indexer/discovery.test.ts -t "graftignore"` | ❌ Wave 0 |
| INFRA-04 | `discoverFiles(cwd)` works with no config files present | unit | `pnpm vitest run tests/indexer/discovery.test.ts -t "zero config"` | ❌ Wave 0 |
| INFRA-05 | No bytes written to stdout during parsing (stderr-only logger) | integration | `pnpm vitest run tests/integration/stdout.test.ts` | ❌ Wave 0 |
| INFRA-06 | Error messages include actionable hint text | unit | `pnpm vitest run tests/parser -t "error messages"` | ❌ Wave 0 |
| QUAL-05 | TypeScript strict — no `any`, explicit return types | static | `pnpm tsc --noEmit` | ❌ Wave 0 (tsconfig.json) |
| QUAL-06 | ESLint + Prettier pass | static | `pnpm eslint src && pnpm prettier --check src` | ❌ Wave 0 (eslint.config.ts) |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/parser tests/indexer --reporter=verbose`
- **Per wave merge:** `pnpm vitest run --coverage`
- **Phase gate:** Full suite green + `pnpm tsc --noEmit` + `pnpm eslint src` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — framework configuration
- [ ] `tsconfig.json` — TypeScript strict config with `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`
- [ ] `tsup.config.ts` — CJS build config with WASM asset copy step
- [ ] `eslint.config.ts` — ESLint 9 flat config with `no-console` and TypeScript rules
- [ ] `.prettierrc` — Prettier config
- [ ] `.github/workflows/ci.yml` — GitHub Actions CI pipeline
- [ ] `tests/fixtures/typescript/` — minimal `.ts` and `.tsx` fixture files
- [ ] `tests/fixtures/javascript/` — minimal `.js` fixture file
- [ ] `tests/fixtures/python/` — minimal `.py` fixture file
- [ ] `tests/parser/typescript.test.ts` — covers PARSE-01, PARSE-02, PARSE-04
- [ ] `tests/parser/javascript.test.ts` — covers PARSE-01, PARSE-02 (JS variant)
- [ ] `tests/parser/python.test.ts` — covers PARSE-03, PARSE-05
- [ ] `tests/indexer/discovery.test.ts` — covers INFRA-01, INFRA-02, INFRA-04
- [ ] `tests/integration/stdout.test.ts` — covers INFRA-05
- [ ] Framework install: `pnpm add -D vitest @vitest/coverage-v8`

---

## Sources

### Primary (HIGH confidence)
- [tree-sitter code navigation docs](https://tree-sitter.github.io/tree-sitter/4-code-navigation.html) — tags.scm query format, capture names
- [tree-sitter Node.js bindings Query API](https://tree-sitter.github.io/node-tree-sitter/classes/Parser.Query.html) — `Query` constructor, `captures()`, `matches()` signatures
- [web-tree-sitter binding_web README](https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md) — `locateFile` pattern, `Parser.init()` API
- [tree-sitter-typescript GitHub](https://github.com/tree-sitter/tree-sitter-typescript) — tsx vs typescript grammar separation
- [vitest coverage docs](https://vitest.dev/guide/coverage.html) — `@vitest/coverage-v8` V8 provider, AST remapping since v3.2.0
- [ESLint flat config blog 2025](https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/) — `defineConfig()` helper, TypeScript config file support in v9.18.0
- [fast-glob GitHub](https://github.com/mrmlnc/fast-glob) — glob API, `cwd`, `absolute`, `followSymbolicLinks` options
- [ignore npm](https://www.npmjs.com/package/ignore) — `.gitignore` spec implementation

### Secondary (MEDIUM confidence)
- [STACK.md](.planning/research/STACK.md) — project-level stack decisions (CJS output, chalk@4, ora@5, zod v3)
- [PITFALLS.md](.planning/research/PITFALLS.md) — stdout contamination, WASM version lock-in, tsx/ts grammar mismatch
- [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) — component structure, Tag type, build order rationale
- [web-tree-sitter npm page](https://www.npmjs.com/package/web-tree-sitter) — WASM path resolution, version history
- [Pulsar blog: Modern Tree-sitter part 7](https://blog.pulsar-edit.dev/posts/20240902-savetheclocktower-modern-tree-sitter-part-7/) — WASM vs native performance tradeoffs

### Tertiary (LOW confidence)
- [tsup documentation](https://tsup.egoist.dev/) — CJS output config (documentation page returned navigation-only content; patterns derived from LogRocket article + npm page)
- [TypeScript in 2025 ESM/CJS article](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing) — dual-format publishing patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core packages confirmed via official npm/docs; version constraints verified against open GitHub issues
- Architecture: HIGH — validated against project's existing ARCHITECTURE.md which was researched against Aider's production implementation
- Pitfalls: HIGH — verified via official GitHub issues and the project's PITFALLS.md research
- WASM path resolution: MEDIUM — `locateFile` pattern confirmed; exact grammar WASM file paths within npm packages require verification at install time

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (30 days — stable tools; tree-sitter WASM strategy check recommended if any tree-sitter package updates)
