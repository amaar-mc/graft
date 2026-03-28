---
phase: 4
slug: quality-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test` |
| **Full suite command** | `pnpm test:coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | QUAL-02 | fixture setup | `ls tests/fixtures/integration/` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | QUAL-04 | refactor | `pnpm test` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | QUAL-01 | unit (coverage) | `pnpm test:coverage` | ❌ W1 | ⬜ pending |
| 04-03-01 | 03 | 1 | QUAL-02 | integration | `pnpm test` | ❌ W1 | ⬜ pending |
| 04-03-02 | 03 | 1 | QUAL-03 | snapshot | `pnpm test` | ❌ W1 | ⬜ pending |
| 04-04-01 | 04 | 2 | QUAL-04 | e2e | `pnpm test` | ❌ W2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/fixtures/integration/ts-project/` — static TS files with cross-imports
- [ ] `tests/fixtures/integration/python-project/` — static Python files with cross-imports
- [ ] `tests/fixtures/integration/mixed-project/` — TS + Python files (separate dependency graphs)
- [ ] Extract `createGraftServer()` from `src/mcp/server.ts` for in-process E2E testing
- [ ] `tests/errors.test.ts` — stub for error subclass coverage gap

*Wave 0 must complete before any Wave 1 plans execute.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
