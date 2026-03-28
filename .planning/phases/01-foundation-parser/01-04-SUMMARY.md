---
phase: 01-foundation-parser
plan: "04"
subsystem: testing
tags: [vitest, tree-sitter, typescript, javascript, python, parser, tdd, stdout, mcp]

requires:
  - phase: 01-foundation-parser/01-03
    provides: parseFile, parseFiles, TypeScript/Python extractors, CodeNode types

provides:
  - Full behavioral test coverage for TS/JS/TSX parser (PARSE-01, PARSE-02, PARSE-04, PARSE-06)
  - Full behavioral test coverage for Python parser (PARSE-03, PARSE-05, PARSE-06)
  - stdout contamination integration test proving INFRA-05 end-to-end

affects:
  - Any future parser changes (tests serve as regression guard)
  - Phase 2+ consumers of CodeNode shape

tech-stack:
  added: []
  patterns:
    - "TDD-via-integration: test files against fixture files using real tree-sitter parsing, not mocks"
    - "Stdout mock via vi.spyOn(process.stdout, 'write') for INFRA-05 verification"
    - "findNode helper for asserting specific CodeNode presence by name + kind"

key-files:
  created:
    - tests/parser/typescript.test.ts
    - tests/parser/javascript.test.ts
    - tests/parser/python.test.ts
    - tests/integration/stdout.test.ts
  modified:
    - src/parser/languages/python.ts

key-decisions:
  - "Python methods now emit 'method' kind via upsertNode override — tags.scm marks all function_definitions as 'function', AST walk with insideClass tracking upgrades them to 'method'"
  - "import_from_statement module path uses module_name field directly (handles relative_import nodes natively) instead of manual dot counting"
  - "Python imported names collected via dotted_name namedChildren (not 'identifier' type) matching actual tree-sitter Python grammar"

patterns-established:
  - "Parser bug fixes go in same commit as the test that caught them (co-located history)"
  - "insideClass flag propagates transitively in Python AST walk, resets on entering function scope"

requirements-completed:
  - PARSE-01
  - PARSE-02
  - PARSE-03
  - PARSE-04
  - PARSE-05
  - PARSE-06
  - INFRA-05

duration: 5min
completed: "2026-03-28"
---

# Phase 01 Plan 04: Parser Test Suite Summary

**52 tests covering TypeScript/JS/TSX and Python parsers with 3 auto-fixed bugs in Python extractor (method kind, import references, relative import module paths)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T07:41:30Z
- **Completed:** 2026-03-28T07:46:36Z
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- 52 tests written across 4 test files, all passing
- TypeScript parser tests verify function, class, method, interface, type, enum, constant, import references, barrel re-exports, TSX components, and CodeNode shape
- Python parser tests verify function, class, method, constant, from-imports, relative imports, decorators, and dataclasses
- stdout contamination test confirms zero bytes to stdout across TS, JS, Python, and mixed language parsing runs
- 3 bugs in Python extractor caught and fixed during test writing

## Task Commits

1. **Task 1: TypeScript/JavaScript parser tests** - `b1f2133` (test)
2. **Task 2: Python parser tests + auto-fixes** - `0e723dc` (test)
3. **Task 3: stdout contamination integration test** - `6ff7177` (test)

**Plan metadata:** _(final docs commit to follow)_

## Files Created/Modified

- `tests/parser/typescript.test.ts` - 30 tests: PARSE-01 through PARSE-04, PARSE-06 for TS/TSX
- `tests/parser/javascript.test.ts` - 10 tests: PARSE-01, PARSE-02, PARSE-06 for JS
- `tests/parser/python.test.ts` - 18 tests: PARSE-03, PARSE-05, PARSE-06 for Python
- `tests/integration/stdout.test.ts` - 4 tests: INFRA-05 stdout contamination guard
- `src/parser/languages/python.ts` - 3 bug fixes (method kind, import references, module paths)

## Decisions Made

- Python methods now correctly emit `'method'` kind using `upsertNode` override in AST walk with an `insideClass` tracking flag. The tags.scm Python grammar captures all `function_definition` nodes as `definition.function` (no `definition.method` exists), so the AST walk must override after Phase 1 completes.
- `import_from_statement` module path now uses `childForFieldName('module_name')` text directly. The `relative_import` node already contains the full path (`.`, `..core`, `.models`) — no manual dot-counting needed.
- Python imported names use `dotted_name` child type matching, not `identifier` — the tree-sitter Python grammar uses `dotted_name` for all imported symbols.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Python class methods emitted with kind 'function' instead of 'method'**
- **Found during:** Task 2 (Python parser tests)
- **Issue:** Python tags.scm has no `definition.method` capture — all `function_definition` nodes (including class methods) are tagged as `definition.function`. The AST walk also used `kind: 'function'` and the deduplication blocked the override.
- **Fix:** Added `insideClass: boolean` parameter to `walkNode`, `upsertNode` helper that always overwrites existing entries. When `insideClass=true` and a `function_definition` is found, emit `kind: 'method'` via `upsertNode`. The `insideClass` flag propagates transitively (like `insideFunction`) and resets when entering function scope.
- **Files modified:** `src/parser/languages/python.ts`
- **Verification:** `get_user`, `connection_string`, and all class methods now have `kind: 'method'`
- **Committed in:** `0e723dc` (Task 2 commit)

**2. [Rule 1 - Bug] Python import_from_statement emitted empty references**
- **Found during:** Task 2 (Python parser tests)
- **Issue:** The `import_from_statement` handler looked for `identifier` type children for imported names, but the tree-sitter Python grammar represents imported names as `dotted_name` nodes (e.g., `path` in `from os import path`).
- **Fix:** Changed imported name collection to match `dotted_name` and `identifier` types, skipping the module_name node.
- **Files modified:** `src/parser/languages/python.ts`
- **Verification:** `from os import path` → references contains `'path'`; relative imports (`from .models import User`) → references contains `'User'`
- **Committed in:** `0e723dc` (Task 2 commit)

**3. [Rule 1 - Bug] Python relative import module paths extracted incorrectly**
- **Found during:** Task 2 (Python parser tests)
- **Issue:** The module path extraction tried to count `.` chars from child nodes of type `'.'`, but the tree-sitter Python grammar represents relative imports as a `relative_import` node in the `module_name` field. The existing code was double-prefixing dots and failing to get the correct path.
- **Fix:** Use `childForFieldName('module_name')` text directly — the `relative_import` node already contains the complete path string (`.`, `..core`, `.models`).
- **Files modified:** `src/parser/languages/python.ts`
- **Verification:** `from . import utils` → name=`'.'`; `from ..core import base` → name=`'..core'`; `from .models import User` → name=`'.models'`
- **Committed in:** `0e723dc` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** All fixes were necessary for parser correctness. No scope creep. Tests directly drove bug discovery.

## Issues Encountered

None beyond the bugs documented above as deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Parser pipeline has full behavioral test coverage (PARSE-01 through PARSE-06, INFRA-05)
- All 52 tests pass; Python extractor is now correct for methods, imports, and relative paths
- Discovery test suite (01-02) + parser test suite (01-04) form the regression guard for Phase 1
- Phase 2 (graph building) can rely on CodeNode shape contract validated here

---
*Phase: 01-foundation-parser*
*Completed: 2026-03-28*
