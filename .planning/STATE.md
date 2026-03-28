# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** Any developer can run `npx graft serve` and immediately give their AI coding tool accurate, ranked, token-efficient understanding of their entire codebase — without any code leaving their machine.
**Current focus:** Phase 1 — Foundation + Parser

## Current Position

Phase: 1 of 4 (Foundation + Parser)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-27 — Roadmap created, all 45 v1 requirements mapped to 4 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Native tree-sitter as primary, WASM fallback — portability with speed where available
- [Init]: CJS output (tsup) for `npx` compatibility — ESM chalk/ora not worth the install friction
- [Init]: Zod must stay on v3.x — v4 crashes MCP SDK v1 at runtime (no build-time signal)
- [Init]: stderr-only logger must be created in Phase 1 before any output code — stdout contamination kills MCP sessions silently

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: WASM grammar version pinning and `locateFile` path resolution in bundled `npx` context is the highest-variance integration point — needs spike before architecture is finalized
- [Phase 3]: MCP client keep-alive semantics on disconnect/reconnect not fully specified — needs live test against Claude Code before Phase 3 ships

## Session Continuity

Last session: 2026-03-27
Stopped at: Roadmap created and written to disk. Ready for `plan-phase 1`.
Resume file: None
