---
phase: 01-foundation-parser
plan: 03
subsystem: parser
tags: [tree-sitter, web-tree-sitter, wasm, typescript, python, ast, code-analysis]

# Dependency graph
requires:
  - phase: 01-foundation-parser/01-01
    provides: "CodeNode/ParseResult types, error classes, logger — all imported here"
provides:
  - "web-tree-sitter WASM initialization with locateFile path resolution"
  - "Grammar loading for TypeScript, TSX, JavaScript, Python"
  - "TypeScript/JS/TSX node extractor covering functions, classes, methods, interfaces, types, enums, imports, barrel re-exports"
  - "Python node extractor covering functions, classes, decorators, relative imports, __init__.py barrel exports, constants"
  - "Parser orchestrator with bounded concurrency (max 8) and graceful skip for unsupported extensions"
affects: [graph-builder, renderer, mcp-server, test-suite]

# Tech tracking
tech-stack:
  added: [web-tree-sitter, tree-sitter-typescript, tree-sitter-python, tree-sitter-javascript]
  patterns:
    - "WASM loaded once via initParser() cached promise, grammars cached per-process"
    - "Two-phase extraction: tags.scm query captures then AST walk for uncovered constructs"
    - "Dev vs dist WASM path resolution via ordered candidate list"
    - "Deduplication by CodeNode id (filePath:name:startLine)"

key-files:
  created:
    - src/parser/tree-sitter.ts
    - src/parser/languages/typescript.ts
    - src/parser/languages/python.ts
    - src/parser/index.ts
  modified: []

key-decisions:
  - "Two-phase extraction (tags.scm + AST walk) because TypeScript tags.scm only covers function_signature/method_signature/interface/module — not function_declaration, class_declaration, type_alias_declaration, enum_declaration"
  - "Empty Query fallback when tags.scm compilation fails — extractor degrades gracefully to pure AST walk"
  - "Arrow functions assigned to const variables emit as 'function' kind (not 'variable')"
  - "Python __init__.py relative imports emit as 'export' kind to model barrel file semantics"
  - "insideFunction tracking in AST walk prevents emitting nested constants and arrow functions as top-level definitions"

patterns-established:
  - "Parser entry: src/parser/index.ts exports parseFile() and parseFiles() — all consumers use this module"
  - "Language dispatch: fileExtensionToLanguage() determines extractor; unsupported ext → empty result, no throw"
  - "Node id format: filePath:name:startLine — unique within a parse session"
  - "Decorator capture: predecessor sibling walk to collect @decorator names into references array"

requirements-completed: [PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06, INFRA-05]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 1 Plan 03: Tree-sitter Parser Implementation Summary

**web-tree-sitter WASM parser with TypeScript/Python AST extractors producing typed CodeNode arrays from function, class, method, interface, type, enum, import, and export definitions**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-28T07:33:36Z
- **Completed:** 2026-03-28T07:38:27Z
- **Tasks:** 4
- **Files created:** 4

## Accomplishments

- `src/parser/tree-sitter.ts` — WASM runtime initialization, grammar loading with dev/dist path resolution, tag query compilation with empty-query fallback
- `src/parser/languages/typescript.ts` — Extracts all required TS constructs: functions, classes, methods, interfaces, type aliases, enums, imports, barrel re-exports, decorators; handles arrow functions in const declarations
- `src/parser/languages/python.ts` — Extracts functions, classes (including dataclasses via decorators), relative imports, `__init__.py` barrel exports, SCREAMING_SNAKE_CASE constants
- `src/parser/index.ts` — Orchestrator with 8-concurrent Promise pool, graceful extension skip, single init() cache across all calls

## Task Commits

1. **Task 1: web-tree-sitter initialization and grammar loading** - `8c395d5` (feat)
2. **Task 2: TypeScript/JavaScript/TSX node extraction** - `fb3b1dd` (feat)
3. **Task 3: Python node extraction** - `0585f87` (feat)
4. **Task 4: Parser orchestrator** - `1df1750` (feat)

## Files Created/Modified

- `src/parser/tree-sitter.ts` — WASM init, loadLanguage(), parseSource(), createTagQuery()
- `src/parser/languages/typescript.ts` — extractTypeScriptNodes() with full AST walk
- `src/parser/languages/python.ts` — extractPythonNodes() with decorator/import/constant handling
- `src/parser/index.ts` — parseFile() and parseFiles() with bounded concurrency

## Decisions Made

- **Two-phase extraction** (tags.scm + AST walk): The TypeScript tags.scm only covers `function_signature`, `method_signature`, `interface_declaration`, and `module` — it misses `function_declaration`, `class_declaration`, `type_alias_declaration`, and `enum_declaration`. AST walk fills the gaps while tags.scm handles abstract/signatures.
- **Empty Query fallback**: If `tags.scm` compilation fails (grammar version mismatch), `createTagQuery()` returns an empty `new Query(language, '')` so extractors fall back to pure AST walking without crashing.
- **`insideFunction` scope tracking**: AST walker tracks function scope depth so nested constants and inner arrow functions aren't emitted as top-level definitions.

## Deviations from Plan

None — plan executed exactly as written. The `web-tree-sitter` API uses named exports (`Parser`, `Language`, `Query`) rather than a default export namespace, which required an import adjustment, but this is a normal TypeScript/CJS import pattern, not a deviation from the plan's intent.

## Issues Encountered

- **web-tree-sitter named exports**: The type definitions export `Parser`, `Language`, `Query` as named classes, not as `Parser.Language`/`Parser.Query` namespace members. Fixed by using `import { Parser, Language, Query } from 'web-tree-sitter'` instead of `import Parser from 'web-tree-sitter'`.
- **TypeScript tags.scm coverage**: Much narrower than expected — only 4 patterns covering signatures, not declarations. Two-phase approach (tags + AST walk) handles this correctly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Parser is fully operational: WASM loads, all four language grammars load, TypeScript and Python files produce typed CodeNode arrays
- `src/parser/index.ts` exports `parseFile` and `parseFiles` — ready for graph builder consumption in Phase 2
- Test coverage for parser correctness comes in Plan 04

---
*Phase: 01-foundation-parser*
*Completed: 2026-03-28*

## Self-Check: PASSED

- FOUND: src/parser/tree-sitter.ts
- FOUND: src/parser/languages/typescript.ts
- FOUND: src/parser/languages/python.ts
- FOUND: src/parser/index.ts
- FOUND commit: 8c395d5 (Task 1)
- FOUND commit: fb3b1dd (Task 2)
- FOUND commit: 0585f87 (Task 3)
- FOUND commit: 1df1750 (Task 4)
