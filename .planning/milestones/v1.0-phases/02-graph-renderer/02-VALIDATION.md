---
phase: 02
slug: graph-renderer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm test:coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | GRAPH-01 | unit | `pnpm vitest run tests/graph/build.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | GRAPH-04, GRAPH-05 | unit | `pnpm vitest run tests/graph/queries.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | GRAPH-02 | unit | `pnpm vitest run tests/graph/pagerank.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | GRAPH-03 | unit | `pnpm vitest run tests/graph/personalized.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | GRAPH-06 | unit | `pnpm vitest run tests/graph/impact.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | REND-01, REND-03 | unit | `pnpm vitest run tests/renderer/tree.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | REND-02, REND-05 | unit | `pnpm vitest run tests/renderer/budget.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | REND-04 | unit | `pnpm vitest run tests/renderer/json.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | INFRA-03 | unit | `pnpm vitest run tests/cache/cache.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/graph/build.test.ts` — stubs for GRAPH-01, GRAPH-04, GRAPH-05
- [ ] `tests/graph/pagerank.test.ts` — stubs for GRAPH-02, GRAPH-03
- [ ] `tests/graph/impact.test.ts` — stubs for GRAPH-06
- [ ] `tests/renderer/tree.test.ts` — stubs for REND-01, REND-03
- [ ] `tests/renderer/budget.test.ts` — stubs for REND-02, REND-05
- [ ] `tests/renderer/json.test.ts` — stubs for REND-04
- [ ] `tests/cache/cache.test.ts` — stubs for INFRA-03

*Existing infrastructure covers vitest framework and config.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
