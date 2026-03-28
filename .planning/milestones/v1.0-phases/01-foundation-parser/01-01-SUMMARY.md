---
phase: 01-foundation-parser
plan: 01
subsystem: infra
tags: [typescript, eslint, vitest, tsup, tree-sitter, prettier, github-actions]

# Dependency graph
requires: []
provides:
  - TypeScript strict project scaffold with pnpm, tsup CJS build, Vitest v8 coverage
  - stderr-only logger preventing stdout contamination in MCP server mode
  - GraftError hierarchy with actionable hint messages
  - CodeNode/ParseResult/LanguageId type contract as core parser seam
  - ESLint 9/10 flat config enforcing no-console and no-explicit-any across src/
  - Test fixtures for TypeScript, JavaScript, and Python parser development
  - GitHub Actions CI with typecheck + lint + test + build steps
affects:
  - 01-02 (TypeScript parser uses CodeNode types and loader pattern)
  - 01-03 (JavaScript parser uses same CodeNode contract)
  - 01-04 (Python parser uses same CodeNode contract)
  - 01-05 (file discovery uses fast-glob + ignore installed here)
  - all subsequent phases (stderr logger prevents stdout contamination)

# Tech tracking
tech-stack:
  added:
    - typescript@5.9.3 (pinned to 5.x for @typescript-eslint compatibility)
    - tsup@8.5.1 (CJS build, WASM file copying via onSuccess)
    - vitest@4.1.2 with @vitest/coverage-v8 (v8 coverage provider)
    - eslint@10.1.0 with @typescript-eslint/eslint-plugin@8.57.2
    - jiti@2.6.1 (required by ESLint 10 for TypeScript config loading)
    - prettier@3.8.1
    - web-tree-sitter@0.26.7 (WASM parser runtime)
    - tree-sitter-typescript@0.23.2, tree-sitter-javascript@0.25.0, tree-sitter-python@0.25.0
    - fast-glob@3.3.3, ignore@7.0.5
  patterns:
    - stderr-only logging pattern via process.stderr.write (never console.log)
    - GraftError with hint field for actionable error messages
    - CodeNode as universal parser output contract (all parsers produce, all consumers depend on)
    - CJS-only tsup output with outExtension for .cjs files (npx compatibility)
    - ESLint flat config (.ts) with no-console enforced on src/ except src/cli/

key-files:
  created:
    - package.json
    - tsconfig.json
    - tsup.config.ts
    - vitest.config.ts
    - eslint.config.ts
    - .prettierrc
    - .gitignore
    - src/cli/index.ts
    - src/logger.ts
    - src/errors.ts
    - src/parser/types.ts
    - tests/fixtures/typescript/basic.ts
    - tests/fixtures/typescript/react.tsx
    - tests/fixtures/typescript/barrel.ts
    - tests/fixtures/javascript/basic.js
    - tests/fixtures/python/basic.py
    - tests/fixtures/python/classes.py
    - tests/fixtures/python/imports.py
    - .github/workflows/ci.yml
  modified: []

key-decisions:
  - "TypeScript pinned to 5.9.3 — TS 6.0.2 was auto-installed but @typescript-eslint 8.x requires <6.0.0; pinned to latest 5.x for full toolchain compatibility"
  - "jiti installed as dev dependency — ESLint 10 requires it for loading eslint.config.ts even on Node 25 with native TS stripping (strip mode, not transform)"
  - "outExtension forcing .cjs — tsup default produces .js for CJS output; added outExtension to match package.json main field at dist/index.cjs"
  - "types field uses dist/index.d.ts — tsup dts output produces .d.ts not .d.cts; package.json types updated to match actual output"

patterns-established:
  - "Pattern: stderr logger — all non-CLI modules use src/logger.ts exclusively; ESLint no-console enforces this"
  - "Pattern: GraftError.hint — every error class carries a user-facing hint explaining what action to take"
  - "Pattern: CodeNode seam — parsers produce CodeNode[], graph and renderer consume CodeNode[]; ASTs never leak downstream"
  - "Pattern: WASM copy on build — tsup onSuccess copies all .wasm files from node_modules to dist/ for bundled npx usage"

requirements-completed: [INFRA-05, INFRA-06, QUAL-05, QUAL-06]

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 01 Plan 01: Foundation Scaffold Summary

**TypeScript strict project with CJS tsup build, Vitest v8 coverage, ESLint 10 flat config, stderr logger, GraftError hierarchy, CodeNode type contract, parser test fixtures, and GitHub Actions CI**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T07:24:04Z
- **Completed:** 2026-03-28T07:30:13Z
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments
- Full TypeScript project scaffold: strict mode, Node16 module resolution, CJS output via tsup targeting node18
- ESLint 10 flat config (`eslint.config.ts`) with `no-console` on `src/` (off for `src/cli/`) and `no-explicit-any` enforced
- `src/logger.ts`: stderr-only logger that prevents stdout contamination before MCP server is added in Phase 3
- `src/errors.ts`: `GraftError` hierarchy (`ParseError`, `DiscoveryError`, `GrammarLoadError`) with `hint` field for actionable user messages
- `src/parser/types.ts`: `CodeNode`, `ParseResult`, `NodeKind`, `LanguageId` type contract — the universal seam all parsers produce and all consumers depend on
- 7 parser test fixtures covering TypeScript, TSX, barrel exports, JavaScript, and Python (basic, dataclasses/decorators, relative imports)
- GitHub Actions CI running typecheck + lint + test:coverage + build on ubuntu-latest/node20

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize project and install all dependencies** - `9f67d2e` (feat)
2. **Task 2: Create ESLint config, logger, error classes, and CodeNode types** - `815cb87` (feat)
3. **Task 3: Create test fixtures and GitHub Actions CI** - `9e0f328` (feat)
4. **Prettier fix (deviation)** - `7ec3a4f` (fix)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `package.json` - graft 0.0.1 with CJS main, bin, and all dev scripts
- `tsconfig.json` - strict mode, noUncheckedIndexedAccess, Node16 module resolution
- `tsup.config.ts` - CJS build with outExtension .cjs and WASM file copying
- `vitest.config.ts` - v8 coverage with 90/90/80 line/function/branch thresholds
- `eslint.config.ts` - ESLint 10 flat config: no-console + no-explicit-any on src/
- `.prettierrc` - singleQuote, trailingComma all, printWidth 100
- `.gitignore` - node_modules, dist, coverage, .graft
- `src/cli/index.ts` - shebang + placeholder for tsup entry point
- `src/logger.ts` - stderr-only log/debug/info/warn/error convenience functions
- `src/errors.ts` - GraftError + ParseError + DiscoveryError + GrammarLoadError with hint field
- `src/parser/types.ts` - NodeKind, CodeNode, ParseResult, LanguageId, fileExtensionToLanguage
- `tests/fixtures/typescript/basic.ts` - greet fn, User interface, UserService class, Role enum, UserId type
- `tests/fixtures/typescript/react.tsx` - Dashboard component with DashboardProps (tsx grammar path)
- `tests/fixtures/typescript/barrel.ts` - re-exports for PARSE-04 barrel handling tests
- `tests/fixtures/javascript/basic.js` - fetchData fn, DataService class, default export
- `tests/fixtures/python/basic.py` - greet fn, UserService class (PARSE-03 basics)
- `tests/fixtures/python/classes.py` - @dataclass Config, @cache decorator, Repository (PARSE-05)
- `tests/fixtures/python/imports.py` - relative imports for PARSE-05 testing
- `.github/workflows/ci.yml` - CI pipeline with pnpm v9, node v20, frozen lockfile

## Decisions Made
- **TypeScript pinned to 5.9.3:** pnpm auto-installed TS 6.0.2, but `@typescript-eslint` 8.57.2 requires `<6.0.0`. Pinned to latest 5.x (5.9.3) for full toolchain compatibility. TS 6 support tracked via `@typescript-eslint` release notes.
- **jiti as dev dep:** ESLint 10 needs `jiti` to load `.ts` config files even on Node 25 (native TS stripping is `strip` mode, not `transform`; ESLint's path specifically requires jiti when not in transform mode).
- **outExtension `.cjs`:** tsup default produces `.js` extension for CJS; added `outExtension: () => ({ js: '.cjs' })` so `dist/index.cjs` matches `package.json` main.
- **types → dist/index.d.ts:** tsup dts plugin produces `.d.ts` (not `.d.cts`); updated package.json `types` field to match actual output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript 6.0.2 incompatible with @typescript-eslint 8.57.2**
- **Found during:** Task 1 (dependency installation)
- **Issue:** `pnpm add -D typescript` pulled TypeScript 6.0.2 which fails `@typescript-eslint` peer dependency check (`>=4.8.4 <6.0.0`)
- **Fix:** Pinned to `typescript@5.9.3` (latest stable 5.x)
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Verification:** Peer dependency warnings gone; `pnpm tsc --noEmit` succeeds
- **Committed in:** `9f67d2e` (Task 1 commit)

**2. [Rule 3 - Blocking] ESLint 10 requires jiti for .ts config loading**
- **Found during:** Task 2 (ESLint verification)
- **Issue:** `pnpm eslint src` failed: "The 'jiti' library is required for loading TypeScript configuration files"
- **Fix:** `pnpm add -D jiti` (v2.6.1)
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm eslint src` exits 0
- **Committed in:** `815cb87` (Task 2 commit)

**3. [Rule 1 - Bug] tsup output extension mismatch**
- **Found during:** Task 1 (build verification)
- **Issue:** tsup produced `dist/index.js` but package.json main was `dist/index.cjs`
- **Fix:** Added `outExtension: () => ({ js: '.cjs' })` to tsup config; updated package.json types from `.d.cts` to `.d.ts`
- **Files modified:** `tsup.config.ts`, `package.json`
- **Verification:** `dist/index.cjs` exists after build
- **Committed in:** `9f67d2e` (Task 1 commit)

**4. [Rule 1 - Bug] Prettier formatting in src/errors.ts**
- **Found during:** Overall verification (`pnpm prettier --check src`)
- **Issue:** Multi-line constructor call in `GrammarLoadError` failed Prettier format check
- **Fix:** `pnpm prettier --write src`
- **Files modified:** `src/errors.ts`
- **Verification:** `pnpm prettier --check src` exits 0
- **Committed in:** `7ec3a4f`

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bug)
**Impact on plan:** All auto-fixes necessary for correctness and toolchain compatibility. No scope creep.

## Issues Encountered
- `@typescript-eslint` 8.x does not yet support TypeScript 6.x — pinned to TS 5.9.3 as pragmatic fix. Watch for `@typescript-eslint` 9.x which is expected to add TS 6 support.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TypeScript parser (01-02) can import `CodeNode`, `ParseResult`, `fileExtensionToLanguage` from `src/parser/types.ts`
- Logger available at `src/logger.ts` for any parse-time debug output (stderr only)
- Error classes available at `src/errors.ts` for `ParseError` and `GrammarLoadError` throws
- Test fixtures in `tests/fixtures/` cover all parser test scenarios
- Build pipeline and CI both verified working

---
*Phase: 01-foundation-parser*
*Completed: 2026-03-28*
