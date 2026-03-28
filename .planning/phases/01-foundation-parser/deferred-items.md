# Deferred Items

## Pre-existing TypeScript errors in src/parser/tree-sitter.ts

**Discovered during:** 01-02 execution, `pnpm tsc --noEmit`

**Errors:**
- `src/parser/tree-sitter.ts(12,21)`: Cannot use namespace 'Parser' as a type
- `src/parser/tree-sitter.ts(119,18)`: Property 'init' does not exist on type 'typeof import("web-tree-sitter")'
- `src/parser/tree-sitter.ts(126,26)`: This expression is not constructable
- `src/parser/tree-sitter.ts(197,33)`: Property 'query' does not exist on type 'Language'
- `src/parser/tree-sitter.ts(207,22)`: Property 'query' does not exist on type 'Language'
- `src/parser/tree-sitter.ts(214,22)`: Property 'query' does not exist on type 'Language'

**Context:** These errors appear to be from web-tree-sitter WASM API type mismatches — likely a known issue flagged in STATE.md under blockers ("WASM grammar version pinning and locateFile path resolution"). Out of scope for 01-02 (file discovery). Will be addressed in parser phase plans.
