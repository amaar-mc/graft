---
phase: 03
slug: cli-mcp
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm vitest run --reporter=verbose` |
| **Full suite command** | `pnpm test:coverage` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | CLI-01, CLI-07 | unit | `pnpm vitest run tests/cli/` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | CLI-02, CLI-03, CLI-04, CLI-05 | unit | `pnpm vitest run tests/cli/` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | CLI-06 | unit | `pnpm vitest run tests/cli/` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | MCP-01 | unit | `pnpm vitest run tests/mcp/server.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | MCP-02, MCP-03, MCP-04, MCP-05, MCP-06 | unit | `pnpm vitest run tests/mcp/tools.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | MCP-07, MCP-08 | unit | `pnpm vitest run tests/mcp/resources.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 2 | MCP-09 | unit | `pnpm vitest run tests/mcp/schema-size.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/cli/` — stubs for CLI command tests
- [ ] `tests/mcp/` — stubs for MCP server, tools, resources tests

*Existing infrastructure covers vitest framework and config.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Beautiful colored output in terminal | CLI-06 | Visual styling requires human eye | Run `npx graft map` in a real terminal, verify colors and tree characters |
| MCP tool callable from Claude Code | MCP-02-06 | Requires live MCP client connection | Add to claude_desktop_config.json, verify tools appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
