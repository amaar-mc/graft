---
phase: 01-foundation-parser
verified: 2026-03-28T01:05:00Z
status: passed
score: 5/5 success criteria verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "TypeScript strict mode enforced (no any, no unsafe casts), ESLint + Prettier passing, all functions have explicit return types — QUAL-06 now fully satisfied: `pnpm prettier --check src` exits 0 and CI runs format:check"
  gaps_remaining: []
  regressions: []
---

# Phase 1: Foundation + Parser Verification Report

**Phase Goal:** Developers can run `npx graft` in any repo and get structured symbol extraction from TypeScript/JavaScript and Python files, with all project scaffolding in place
**Verified:** 2026-03-28T01:05:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 01-06 closed QUAL-06 Prettier gap)

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `npx graft` discovers all source files respecting .gitignore, skipping node_modules/dist/build without any config file | VERIFIED | `node dist/index.cjs` discovers 24 files from project root; 14 discovery tests (14/14) verify all default ignores, .gitignore, and zero-config mode |
| 2 | Parser extracts `CodeNode` objects from TS/JS files including decorators, generics, enums, barrel files, re-exports | VERIFIED | All 20 TS/JS parser tests pass; basic.ts yields function/interface/class/method/type/enum/constant/import; barrel.ts yields export nodes; react.tsx yields function+interface |
| 3 | Parser extracts `CodeNode` objects from Python files including decorators, relative imports, `__init__.py` re-exports, dataclasses | VERIFIED | All 18 Python parser tests pass; classes.py captures @dataclass and @cache decorators; imports.py captures all three relative import forms |
| 4 | Custom ignore patterns work via `.graftignore` or CLI flag | VERIFIED | discovery.test.ts tests "respects .graftignore rules" and "respects extra ignore patterns passed as argument" — both pass |
| 5 | TypeScript strict mode enforced (no `any`, no unsafe casts), ESLint + Prettier passing, all functions have explicit return types | VERIFIED | `pnpm prettier --check src` exits 0 ("All matched files use Prettier code style!"). ESLint exits 0. TypeScript exits 0. CI now runs Typecheck → Lint → Format check → Test → Build. |

**Score:** 5/5 success criteria verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Project manifest with all dependencies and scripts | VERIFIED | name="graft", bin pointing to dist/index.cjs; format:check script present |
| `tsconfig.json` | TypeScript strict configuration | VERIFIED | strict, noImplicitAny, strictNullChecks, noUncheckedIndexedAccess all true |
| `src/logger.ts` | stderr-only logger | VERIFIED | 27 lines; all output via `process.stderr.write()` |
| `src/errors.ts` | Error classes with hint field | VERIFIED | GraftError with hint and code; ParseError, DiscoveryError, GrammarLoadError exported |
| `src/parser/types.ts` | CodeNode and NodeKind type definitions | VERIFIED | Exports NodeKind, CodeNode, ParseResult, LanguageId, fileExtensionToLanguage |
| `vitest.config.ts` | Test framework configuration | VERIFIED | provider: 'v8', globals: true, thresholds: lines 90, functions 90, branches 80 |
| `eslint.config.ts` | ESLint 9 flat config with TypeScript rules | VERIFIED | no-explicit-any: error, explicit-function-return-type: error; exits 0 |
| `src/indexer/discovery.ts` | discoverFiles with gitignore + graftignore support | VERIFIED | 120 lines; uses fast-glob + ignore; DiscoveryError thrown with hint |
| `src/parser/tree-sitter.ts` | web-tree-sitter initialization and grammar loading | VERIFIED | 219 lines; Prettier-clean; GrammarLoadError on WASM failures |
| `src/parser/index.ts` | Parser orchestrator dispatching to language-specific extractors | VERIFIED | 125 lines; Prettier-clean; bounded concurrency (max 8) |
| `src/parser/languages/typescript.ts` | TypeScript/JavaScript/TSX extraction | VERIFIED | 484 lines; Prettier-clean; handles function/class/method/interface/type/enum/import/export/decorator |
| `src/parser/languages/python.ts` | Python definition and reference extraction | VERIFIED | 323 lines; Prettier-clean; handles function/class/method/constant/import/relative-import/decorator/dataclass |
| `src/cli/index.ts` | Functional CLI entry point | VERIFIED | 48 lines; wires discoverFiles → parseFiles; all output to stderr |
| `tests/indexer/discovery.test.ts` | Unit tests for file discovery | VERIFIED | 178 lines; 14 tests |
| `tests/parser/typescript.test.ts` | TS/JS/TSX parser test suite | VERIFIED | 166 lines; 20 tests |
| `tests/parser/python.test.ts` | Python parser test suite | VERIFIED | 151 lines; 18 tests |
| `tests/parser/javascript.test.ts` | JavaScript parser test suite | VERIFIED | 86 lines |
| `tests/integration/stdout.test.ts` | stdout contamination integration test | VERIFIED | 83 lines; 4 tests all pass with 0 stdout bytes |
| `.github/workflows/ci.yml` | CI pipeline with GitHub Actions | VERIFIED | Runs: Typecheck → Lint → Format check → Test with coverage → Build. Format check step added at line 37. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `.github/workflows/ci.yml` | `pnpm format:check` | `run: pnpm format:check` step | VERIFIED | Lines 37-38: `- name: Format check` / `run: pnpm format:check`; positioned after Lint, before Test |
| `src/logger.ts` | `process.stderr` | direct write | VERIFIED | `process.stderr.write()` on line 7; stdout contamination test confirms 0 bytes on stdout |
| `eslint.config.ts` | `src/**/*.ts` | no-console rule | VERIFIED | no-console: 'error' present; ESLint exits 0 |
| `src/indexer/discovery.ts` | fast-glob | `import fg from 'fast-glob'` | VERIFIED | Line 3 |
| `src/indexer/discovery.ts` | ignore | `import ignore from 'ignore'` | VERIFIED | Line 4 |
| `src/indexer/discovery.ts` | `src/errors.ts` | DiscoveryError | VERIFIED | Line 5; thrown on line 63 |
| `src/parser/tree-sitter.ts` | web-tree-sitter | `import { Parser, Language, Query } from 'web-tree-sitter'` | VERIFIED | Line 4 |
| `src/parser/index.ts` | `src/parser/types.ts` | CodeNode | VERIFIED | Line 11 |
| `src/cli/index.ts` | `src/indexer/discovery.ts` | discoverFiles | VERIFIED | Line 6; called on line 18 |
| `src/cli/index.ts` | `src/parser/index.ts` | parseFiles | VERIFIED | Line 7; called on line 25 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFRA-01 | 01-02 | .gitignore-aware file discovery skipping node_modules, vendor, dist, build, .git by default | SATISFIED | discovery.ts DEFAULT_IGNORE_DIRS; 14 discovery tests pass |
| INFRA-02 | 01-02 | Custom ignore patterns via .graftignore or CLI flag | SATISFIED | discovery.ts reads .graftignore; accepts extraIgnorePatterns param; both tested |
| INFRA-04 | 01-05, 01-02 | Zero-config startup — works in any directory without config files | SATISFIED | Works with no .gitignore/.graftignore; CLI uses process.cwd(); "works with zero config" test passes |
| INFRA-05 | 01-01, 01-04 | All stdout reserved for MCP JSON-RPC; logging goes to stderr only | SATISFIED | logger.ts uses process.stderr.write exclusively; 4 stdout contamination tests pass with 0 bytes |
| INFRA-06 | 01-01 | Actionable error messages | SATISFIED | GraftError.hint field on all error classes; DiscoveryError and GrammarLoadError both carry actionable hints |
| PARSE-01 | 01-03, 01-04 | Extract definitions from TS/JS with tree-sitter AST | SATISFIED | typescript.ts extracts function/class/method/interface/type/enum/constant; 7 definition tests pass |
| PARSE-02 | 01-03, 01-04 | Extract references from TS/JS | SATISFIED | typescript.ts extracts import statements with referenced names; 2 reference tests pass |
| PARSE-03 | 01-03, 01-04 | Extract definitions and references from Python | SATISFIED | python.ts extracts function/class/method/constant/import; 6 definition+reference tests pass |
| PARSE-04 | 01-03, 01-04 | Handle TS-specific constructs: decorators, generics, type aliases, enums, namespaces, re-exports, barrel files | SATISFIED | typescript.ts handles all constructs; 5 PARSE-04 tests pass |
| PARSE-05 | 01-03, 01-04 | Handle Python-specific constructs: decorators, relative imports, __init__.py re-exports, dataclasses | SATISFIED | python.ts handles @dataclass, @cache, relative imports (., ..core, .models), isInitFile flag; 7 PARSE-05 tests pass |
| PARSE-06 | 01-03, 01-04 | Return structured CodeNode objects with id, name, kind, filePath, startLine, endLine, references | SATISFIED | CodeNode interface has all required fields; id format `${filePath}:${name}:${startLine}` enforced; 5 shape-validation tests each for TS and Python |
| QUAL-05 | 01-01 | Strict TypeScript — no any, no unsafe as casts, all functions have explicit return types | SATISFIED | tsconfig strict+noImplicitAny+strictNullChecks+noUncheckedIndexedAccess; ESLint no-explicit-any: error + explicit-function-return-type: error; `pnpm tsc --noEmit` exits 0 |
| QUAL-06 | 01-01, 01-06 | ESLint + Prettier enforced, CI pipeline with GitHub Actions | SATISFIED | ESLint exits 0. `pnpm prettier --check src` exits 0. CI runs Format check step (line 37-38 of ci.yml). All 66 tests pass after formatting changes. |

---

### Anti-Patterns Found

None. All previously flagged Prettier violations in the 4 parser source files are resolved. The CI gap is closed.

---

### Human Verification Required

None — all phase behavior is verifiable programmatically for Phase 1.

---

### Re-verification Summary

**Gap closed:** QUAL-06 (Prettier enforcement)

Plan 01-06 ran `pnpm prettier --write` on the 4 failing files and added a "Format check" step to `.github/workflows/ci.yml`. Both fixes are confirmed:

- `pnpm prettier --check src` exits 0 — "All matched files use Prettier code style!"
- `.github/workflows/ci.yml` lines 37-38 contain the Format check step positioned between Lint and Test
- All 66 tests still pass (5 test files, 287ms) — zero logic regressions from formatting changes
- ESLint exits 0, TypeScript exits 0

**No regressions detected.** All 5/5 success criteria now verified. Phase goal fully achieved.

---

_Verified: 2026-03-28T01:05:00Z_
_Verifier: Claude (gsd-verifier)_
