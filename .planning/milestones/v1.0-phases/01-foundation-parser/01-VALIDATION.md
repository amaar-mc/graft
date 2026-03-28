---
phase: 1
slug: foundation-parser
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` — Wave 0 gap (does not exist yet) |
| **Quick run command** | `pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm vitest run --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/parser tests/indexer --reporter=verbose`
- **After every plan wave:** Run `pnpm vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | PARSE-01 | unit | `pnpm vitest run tests/parser/typescript.test.ts -t "extracts definitions"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | PARSE-02 | unit | `pnpm vitest run tests/parser/typescript.test.ts -t "extracts references"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | PARSE-03 | unit | `pnpm vitest run tests/parser/python.test.ts -t "extracts definitions"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | PARSE-04 | unit | `pnpm vitest run tests/parser/typescript.test.ts -t "TypeScript specific"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | PARSE-05 | unit | `pnpm vitest run tests/parser/python.test.ts -t "Python specific"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | PARSE-06 | unit | `pnpm vitest run tests/parser -t "CodeNode shape"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | INFRA-01 | unit | `pnpm vitest run tests/indexer/discovery.test.ts -t "default ignores"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | INFRA-02 | unit | `pnpm vitest run tests/indexer/discovery.test.ts -t "graftignore"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | INFRA-04 | unit | `pnpm vitest run tests/indexer/discovery.test.ts -t "zero config"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | INFRA-05 | integration | `pnpm vitest run tests/integration/stdout.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | INFRA-06 | unit | `pnpm vitest run tests/parser -t "error messages"` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | QUAL-05 | static | `pnpm tsc --noEmit` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | QUAL-06 | static | `pnpm eslint src && pnpm prettier --check src` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — framework configuration
- [ ] `tsconfig.json` — TypeScript strict config
- [ ] `tsup.config.ts` — CJS build config with WASM asset copy step
- [ ] `eslint.config.ts` — ESLint 9 flat config with `no-console` and TypeScript rules
- [ ] `.prettierrc` — Prettier config
- [ ] `.github/workflows/ci.yml` — GitHub Actions CI pipeline
- [ ] `tests/fixtures/typescript/` — minimal TS/TSX fixture files
- [ ] `tests/fixtures/javascript/` — minimal JS fixture file
- [ ] `tests/fixtures/python/` — minimal Python fixture file
- [ ] `tests/parser/typescript.test.ts` — covers PARSE-01, PARSE-02, PARSE-04
- [ ] `tests/parser/python.test.ts` — covers PARSE-03, PARSE-05
- [ ] `tests/indexer/discovery.test.ts` — covers INFRA-01, INFRA-02, INFRA-04
- [ ] `tests/integration/stdout.test.ts` — covers INFRA-05
- [ ] Framework install: `pnpm add -D vitest @vitest/coverage-v8`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npx graft` works from clean install | INFRA-04 | Requires `npm pack` + isolated environment | Run `npm pack && cd /tmp && npx ./graft-*.tgz` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
