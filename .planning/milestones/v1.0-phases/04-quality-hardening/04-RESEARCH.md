# Phase 4: Quality + Hardening - Research

**Researched:** 2026-03-28
**Domain:** Vitest (unit/snapshot/coverage), integration testing with fixture codebases, E2E MCP stdio testing
**Confidence:** HIGH

---

## Summary

The project has a fully functional test suite (234 tests, 20 files, all passing) with Vitest 4.x and
@vitest/coverage-v8 already configured. The coverage thresholds in `vitest.config.ts` are already
set (lines 90%, functions 90%, branches 80%) but the suite currently fails them: lines at 87.8%,
functions at 85.18%, branches at 71.14%.

The gaps are specific and measurable. The primary gaps are: (1) `src/mcp/server.ts` lines 237-321
(the `startMcpServer` function — uncovered because only the exported handler functions are unit-tested,
not the McpServer wiring), (2) parser language files with branch misses on edge-case paths, (3)
`errors.ts` with three error subclasses never instantiated in tests, (4) `logger.ts` `warn`/`error`
functions untested, and (5) `renderer/json.ts` and `renderer/tree.ts` branch gaps on edge paths.

Three distinct test types need to be built: integration tests against full fixture codebases
(QUAL-02), snapshot tests for tree renderer output (QUAL-03), and E2E tests that do full MCP
tool invocations via the SDK's `InMemoryTransport` (QUAL-04). The pattern for E2E via
`InMemoryTransport` already exists in `tests/mcp/schema-size.test.ts` and can be extended.

**Primary recommendation:** Target the specific uncovered lines in the coverage report first to
reach the 90% threshold. Then add fixture-based integration tests and snapshot tests. The E2E
MCP pattern is already proven — extend it to cover all five tools.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUAL-01 | Unit tests for every module (parser, graph, renderer, MCP tools) with >90% coverage on core modules | Coverage currently at 87.8% lines / 85.18% functions / 71.14% branches — specific gaps identified in coverage report |
| QUAL-02 | Integration tests with fixture codebases (TypeScript project, Python project, mixed-language project) | Only `tests/integration/stdout.test.ts` exists; no full-pipeline integration tests against multi-file fixture projects |
| QUAL-03 | Snapshot tests for tree renderer output to catch formatting regressions | No snapshot tests exist yet; Vitest `toMatchSnapshot()` is the standard — zero new deps required |
| QUAL-04 | E2E tests that spin up the MCP server, connect a client, call tools, and verify responses | `InMemoryTransport` pattern already used in `tests/mcp/schema-size.test.ts`; needs extension for tool call E2E |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.1.2 | Test runner, snapshot engine, coverage orchestrator | Already installed, configured, all tests passing |
| @vitest/coverage-v8 | ^4.1.2 | V8-based coverage — no instrumentation overhead | Already installed, thresholds already set in vitest.config.ts |
| @modelcontextprotocol/sdk | ^1.28.0 | `InMemoryTransport` + `Client` for E2E MCP testing | Already used in schema-size.test.ts — same pattern extends to tool calls |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| child_process (Node stdlib) | built-in | Subprocess-based CLI/serve tests | Already used in stdout.test.ts and server.test.ts for binary smoke tests |
| tmp (Node os.tmpdir) | built-in via `fs/promises` + `os` | Create temporary fixture directories for integration tests | Use for QUAL-02 fixture codebase tests |
| path (Node stdlib) | built-in | Fixture path resolution | Already used throughout test suite |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest snapshots | Jest snapshots | No reason to switch — Vitest already installed and identical API |
| InMemoryTransport E2E | subprocess spawn E2E | InMemoryTransport is faster, no build required, but subprocess approach validates the full binary. Both are appropriate; InMemoryTransport for tool logic E2E, subprocess for smoke. |

**Installation:**
No new dependencies required. All needed libraries are already installed.

---

## Architecture Patterns

### Recommended Test Directory Structure
```
tests/
├── cache/
│   └── cache.test.ts            (exists, 96% coverage)
├── cli/
│   └── commands.test.ts         (exists)
├── fixtures/
│   ├── typescript/
│   │   ├── basic.ts             (exists)
│   │   ├── barrel.ts            (exists)
│   │   └── react.tsx            (exists)
│   ├── python/
│   │   ├── basic.py             (exists)
│   │   ├── classes.py           (exists)
│   │   └── imports.py           (exists)
│   ├── javascript/
│   │   └── basic.js             (exists)
│   └── integration/             (NEW — full multi-file project fixtures)
│       ├── ts-project/          (NEW — index.ts, utils.ts, types.ts with cross-deps)
│       ├── python-project/      (NEW — main.py, models.py, __init__.py with cross-deps)
│       └── mixed-project/       (NEW — .ts + .py files with internal deps)
├── graph/                       (exists, 96% coverage)
├── indexer/                     (exists, 100% coverage)
├── integration/
│   ├── stdout.test.ts           (exists)
│   └── pipeline.test.ts         (NEW — full-pipeline integration tests)
├── mcp/
│   ├── schema-size.test.ts      (exists)
│   ├── server.test.ts           (exists — subprocess smoke only)
│   ├── tools.test.ts            (exists — handler unit tests)
│   ├── resources.test.ts        (exists)
│   └── e2e.test.ts              (NEW — InMemoryTransport E2E for all 5 tools)
├── parser/                      (exists, ~85% coverage)
└── renderer/
    ├── budget.test.ts           (exists, 100%)
    ├── json.test.ts             (exists, 100%)
    ├── tree.test.ts             (exists, 100%)
    └── tree-snapshot.test.ts    (NEW — Vitest snapshot tests)
```

### Pattern 1: Vitest Snapshot Testing
**What:** Call `expect(output).toMatchSnapshot()` — Vitest writes a `.snap` file on first run, then
diffs on subsequent runs.
**When to use:** QUAL-03 — tree renderer output formatting regression detection.
**Example:**
```typescript
// Source: https://vitest.dev/guide/snapshot
import { describe, it, expect } from 'vitest';

describe('renderTree snapshots', () => {
  it('renders standard graph with correct formatting', () => {
    const output = renderTree(graph, scores, ROOT, DEFAULT_OPTS);
    expect(output).toMatchSnapshot();
  });

  it('renders empty graph snapshot', () => {
    const output = renderTree(emptyGraph, emptyScores, ROOT, DEFAULT_OPTS);
    expect(output).toMatchSnapshot();
  });
});
```
Snapshot files are stored in `tests/renderer/__snapshots__/tree-snapshot.test.ts.snap` and MUST
be committed to git. Run `pnpm test -- --update-snapshots` to regenerate after intentional changes.

### Pattern 2: InMemoryTransport E2E for MCP Tools
**What:** Use `@modelcontextprotocol/sdk`'s `Client` + `InMemoryTransport` pair to connect to the
server in-process, then call `client.callTool()` and verify the response content.
**When to use:** QUAL-04 — verifying all five tools return correct content shapes.
**Example:**
```typescript
// Source: existing tests/mcp/schema-size.test.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 'test', version: '0.0.1' });

// Connect to the server passing the fixture directory as rootDir
await Promise.all([
  client.connect(clientTransport),
  startMcpServer(fixtureDir, serverTransport),  // NOTE: startMcpServer must accept transport arg
  // OR: spin up the server and call server.connect(serverTransport) directly
]);

const result = await client.callTool({ name: 'graft_map', arguments: {} });
expect(result.content[0].text).toContain('tokens');
```
**Key constraint:** `startMcpServer` in `src/mcp/server.ts` currently calls
`new StdioServerTransport()` internally and does not accept an injected transport. For E2E
testing with InMemoryTransport, either: (a) refactor `startMcpServer` to accept an optional
transport parameter, or (b) test the McpServer wiring directly by creating the server and calling
`server.connect(serverTransport)` without going through `startMcpServer`. Option (b) avoids
changing the production API surface.

### Pattern 3: Integration Tests Against Real Fixture Codebases
**What:** Create multi-file fixture projects under `tests/fixtures/integration/`, then run the full
`buildIndex` pipeline against them and assert on the graph shape and ranked output.
**When to use:** QUAL-02 — verifying correct ranked output against realistic codebases.
**Example:**
```typescript
// Integration test: TypeScript project produces correct graph structure
import { buildIndex } from '../../src/indexer/pipeline';
import path from 'path';

const TS_PROJECT = path.resolve(__dirname, '../fixtures/integration/ts-project');

describe('TypeScript project integration', () => {
  it('indexes multi-file project and produces non-empty ranked output', async () => {
    const { graph, scores, files } = await buildIndex(TS_PROJECT);
    expect(files.length).toBeGreaterThan(1);
    // Entry point should rank higher than utility files
    const indexScore = scores.get(path.join(TS_PROJECT, 'index.ts')) ?? 0;
    const utilScore = scores.get(path.join(TS_PROJECT, 'utils.ts')) ?? 0;
    expect(indexScore).toBeGreaterThan(utilScore);
  });
});
```

### Pattern 4: Targeted Unit Tests for Coverage Gaps
**What:** Write focused tests for the specific uncovered lines identified by the coverage report.
**When to use:** QUAL-01 — reaching 90% threshold on all modules.

Coverage gaps by file (from `pnpm test:coverage`):

**`src/errors.ts` (53.84% — lines 19-20, 33-41)**
Three error subclasses (`DiscoveryError`, `GrammarLoadError`, `CacheError`) are never instantiated
in tests. Fix: add a `tests/` test or add assertions in the error-triggering code paths.

**`src/logger.ts` (71.42% — lines 19-23)**
`warn` and `error` functions never called in tests. Fix: add targeted tests that spy on
`process.stderr.write` and call `warn()` / `error()`.

**`src/cache/index.ts` (96.22% — lines 113, 160)**
Two edge-case branches: likely a cache miss path and a file corruption fallback. Fix: add test
that creates a corrupted cache file or simulates the edge condition.

**`src/graph/index.ts` (91.52% — lines 68-69, 87, 106, 146)**
Import resolution edge cases: bare package imports, index file resolution fallbacks, and the
defensive `!knownFiles.has(resolved)` guard. Fix: add graph builder tests with edge-case import
patterns.

**`src/mcp/server.ts` (79.46% — lines 237-321)**
The entire `startMcpServer` function (McpServer registration + resource handlers) is uncovered.
Fix: the E2E tests in QUAL-04 will drive this coverage by exercising the server wiring directly.

**`src/parser/index.ts` (86.27% — various lines)**
Uncovered: `parseFile` when file read fails (line ~44 catch block) and the empty-files-queue
edge case. Fix: mock `fs/promises.readFile` to throw and assert `ParseError` is thrown.

**`src/parser/tree-sitter.ts` (84.72% — lines 96-199, 209-213)**
WASM grammar loader branches: Python grammar fallback paths and grammar initialization error
handling. These are the highest-variance lines (WASM paths). Fix: test the WASM path directly
using Python fixtures (already working in parser tests).

**`src/parser/languages/typescript.ts` and `python.ts` (~85% both)**
Language-specific edge cases: TypeScript namespace handling, Python `__init__.py` edge cases,
decorator patterns. Fix: add fixture files that exercise these specific constructs.

**`src/renderer/tree.ts` and `json.ts` (100% lines, 60-66% branches)**
Branch misses on edge-case paths (empty definitions, budget overflow decisions). The lines are
all covered but branch conditions are not fully exercised. These may not block the threshold since
branches threshold is 80% not 90%.

### Anti-Patterns to Avoid
- **Testing `startMcpServer` via subprocess for coverage:** subprocess tests do not contribute
  to V8 coverage instrumentation. Must use in-process tests (InMemoryTransport) to hit
  `src/mcp/server.ts` lines 237-321.
- **Snapshot tests with dynamic content:** Snapshots must be deterministic. The tree renderer
  includes scores computed by PageRank — always build graphs from fixed in-memory data, not from
  filesystem discovery, so scores are stable across runs.
- **Integration tests that depend on network or global state:** All integration fixtures must be
  self-contained under `tests/fixtures/integration/`. No network calls, no global `.graft/` cache.
- **Large fixture codebases for integration tests:** Keep fixtures small (3-6 files per language).
  The goal is correctness of ranking, not performance benchmarking.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Snapshot diffing | Custom string diffing | `expect(x).toMatchSnapshot()` | Vitest handles file management, diff rendering, update workflow |
| Coverage enforcement | Custom coverage scripts | `vitest run --coverage` with thresholds in vitest.config.ts | Already configured — thresholds already in place |
| MCP client for E2E | Custom JSON-RPC parser | `@modelcontextprotocol/sdk` Client + InMemoryTransport | Already a dependency; proven in schema-size.test.ts |
| Temporary fixture dirs | Custom temp dir helpers | `os.tmpdir()` + `fs/promises.mkdtemp` | Already used in integration tests |

---

## Common Pitfalls

### Pitfall 1: subprocess tests don't contribute to coverage
**What goes wrong:** Adding tests that spawn `dist/index.cjs` as a subprocess and assume those
paths show up in coverage reports.
**Why it happens:** V8 coverage instruments the in-process code. The subprocess runs in a
separate process with its own V8 instance.
**How to avoid:** Use `InMemoryTransport` for MCP E2E testing. Use in-process function calls for
all coverage-targeting tests. Subprocess tests are for behavioral smoke tests only.
**Warning signs:** `src/mcp/server.ts` lines 237-321 stay uncovered even after adding tests.

### Pitfall 2: Snapshot tests with PageRank scores that drift
**What goes wrong:** Integration fixtures are parsed from filesystem, PageRank scores change
slightly due to file discovery order differences across machines/OS.
**Why it happens:** PageRank converges to the same relative ordering but the raw float values
can differ in the last few decimal places depending on tie-breaking order.
**How to avoid:** Build snapshot test graphs from hard-coded in-memory data (fixed files, fixed
edges, fixed seed weights). Do NOT run snapshot tests against real filesystem fixtures.
**Warning signs:** Snapshot tests pass locally but fail in CI.

### Pitfall 3: vitest.config.ts `exclude` omits CLI from coverage but not from threshold calculation
**What goes wrong:** `src/cli/**` is excluded from coverage include list but other modules need
to reach 90%. Forgetting the exclusion and over-counting.
**Why it happens:** The current config explicitly `exclude: ['src/cli/**']` — this is correct.
Do not remove this exclusion; CLI commands are subprocess-tested, not unit-tested.
**How to avoid:** Leave the existing exclusion in place. The 90% threshold applies to the
non-CLI modules only.
**Warning signs:** Coverage drops unexpectedly after changing vitest.config.ts.

### Pitfall 4: startMcpServer not injectable for E2E testing
**What goes wrong:** `startMcpServer` hard-wires `new StdioServerTransport()` internally.
Calling it in tests will block waiting for stdin.
**Why it happens:** The current implementation was designed for production CLI use only.
**How to avoid:** Two options:
  - Option A: Refactor `startMcpServer` to accept an optional transport parameter
    (`transport?: ServerTransport`). Use `StdioServerTransport` as default.
  - Option B: Create a separate `createMcpServer` function that returns the configured
    `McpServer` instance without connecting. Tests call `server.connect(serverTransport)`.
Option B has zero impact on the production API surface and is simpler.
**Warning signs:** E2E tests hang indefinitely waiting for stdin.

### Pitfall 5: Integration fixture files that create invalid cross-language imports
**What goes wrong:** Mixed-language fixture where a `.ts` file imports a `.py` file — the graph
builder silently drops these (not relative imports in the TypeScript sense) but the test author
expects an edge.
**Why it happens:** TypeScript/JS imports use `./` relative paths; Python uses `.module` syntax.
Mixed-language graphs only have edges between same-language files in the current implementation.
**How to avoid:** Mixed-language fixture should have separate TS and Python subgraphs. Assert that
each language cluster is internally connected, not cross-connected.
**Warning signs:** Edge counts are zero in integration test assertions.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Vitest Snapshot Test
```typescript
// Source: https://vitest.dev/guide/snapshot
// File: tests/renderer/tree-snapshot.test.ts
import { describe, it, expect } from 'vitest';
import { renderTree } from '../../src/renderer/tree.js';
// Use same makeGraph/makeNode helpers from existing tree.test.ts

describe('renderTree snapshots (QUAL-03)', () => {
  it('standard 3-file graph snapshot', () => {
    const output = renderTree(graph, scores, ROOT, DEFAULT_OPTS);
    expect(output).toMatchSnapshot();
  });
});
// First run: creates tests/renderer/__snapshots__/tree-snapshot.test.ts.snap
// Subsequent runs: diffs against committed snap file
// Regenerate: pnpm test -- --update-snapshots
```

### InMemoryTransport E2E (from existing schema-size.test.ts pattern)
```typescript
// Source: tests/mcp/schema-size.test.ts (already in codebase)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Create linked transport pair
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: 'e2e-test', version: '0.0.1' });

// Option B: create server without connecting, then connect to test transport
// (requires extracting server creation from startMcpServer)
await Promise.all([
  client.connect(clientTransport),
  server.connect(serverTransport),
]);

// Call a tool
const result = await client.callTool({ name: 'graft_map', arguments: {} });
expect(result.isError).toBeFalsy();
expect(result.content[0].text).toBeDefined();
```

### Integration Test Against Multi-File Fixture
```typescript
// File: tests/integration/pipeline.test.ts
import { buildIndex } from '../../src/indexer/pipeline.js';
import path from 'path';

const TS_FIXTURE = path.resolve(__dirname, '../fixtures/integration/ts-project');

describe('TypeScript project integration (QUAL-02)', () => {
  it('builds graph with correct edges from import statements', async () => {
    const { graph, files } = await buildIndex(TS_FIXTURE);
    expect(files.length).toBeGreaterThanOrEqual(3);
    // index.ts imports from utils.ts — expect a forward edge
    const indexFile = files.find((f) => f.endsWith('index.ts'))!;
    const utilFile = files.find((f) => f.endsWith('utils.ts'))!;
    expect(graph.forwardEdges.get(indexFile)?.has(utilFile)).toBe(true);
  });

  it('ranks entry point higher than leaf utilities', async () => {
    const { scores, files } = await buildIndex(TS_FIXTURE);
    const indexScore = scores.get(files.find((f) => f.endsWith('index.ts'))!)!;
    const leafScore = scores.get(files.find((f) => f.endsWith('types.ts'))!)!;
    expect(indexScore).toBeGreaterThan(leafScore);
  });
});
```

### Error Class Coverage (targeted)
```typescript
// File: tests/errors.test.ts (new)
import { describe, it, expect } from 'vitest';
import { ParseError, DiscoveryError, GrammarLoadError, CacheError } from '../../src/errors.js';

describe('error classes', () => {
  it('ParseError has correct name, code, and hint', () => {
    const err = new ParseError('failed', 'check the file');
    expect(err.name).toBe('ParseError');
    expect(err.code).toBe('PARSE_ERROR');
    expect(err.hint).toBe('check the file');
    expect(err instanceof Error).toBe(true);
  });
  // Same pattern for DiscoveryError, GrammarLoadError, CacheError
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest for TypeScript projects | Vitest (Jest-compatible API) | ~2022 | Vitest is the standard for Vite/tsup projects; no transform config needed |
| Istanbul for coverage | V8 native coverage (@vitest/coverage-v8) | ~2023 | Zero overhead instrumentation, accurate branch tracking |
| Custom snapshot diffing | `toMatchSnapshot()` / `toMatchInlineSnapshot()` | Vitest 1.x | Inline snapshots for short strings, file snapshots for multiline output |

**Deprecated/outdated:**
- Jest: Not deprecated, but Vitest is the default for Node-native TS projects without Babel. Do not add Jest.
- `nyc`/Istanbul: Replaced by V8 coverage provider — already in use via @vitest/coverage-v8.

---

## Open Questions

1. **How to inject transport into startMcpServer for E2E tests?**
   - What we know: `startMcpServer` currently creates `StdioServerTransport` internally.
     The `McpServer` instance is not exposed. The `schema-size.test.ts` creates a new `McpServer`
     directly rather than calling `startMcpServer`.
   - What's unclear: Whether the E2E test should call `startMcpServer` (requiring a refactor) or
     replicate the server registration logic in the test file.
   - Recommendation: Extract a `createGraftServer(rootDir: string): McpServer` function that
     registers all tools and resources but does not call `server.connect()`. `startMcpServer`
     calls `createGraftServer` then connects. Tests call `createGraftServer` then connect to
     `InMemoryTransport`. This is a small, targeted refactor with zero API surface change.

2. **Should integration fixture files live in `tests/fixtures/integration/` as static files or be generated programmatically?**
   - What we know: Existing fixtures (`tests/fixtures/typescript/`, etc.) are static files checked
     into git. The integration stdout test creates temp dirs programmatically.
   - What's unclear: Whether multi-file project fixtures (with real import relationships) are better
     as static fixture files or `fs.mkdtemp` + programmatic file writing.
   - Recommendation: Use static fixture files checked into git. They are more readable, easier
     to inspect, and avoid the complexity of programmatic file creation. Three small sub-directories
     under `tests/fixtures/integration/` cover the three required scenarios.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `pnpm test` |
| Full suite + coverage | `pnpm test:coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-01 | >90% coverage on core modules (lines, functions, branches) | unit (coverage) | `pnpm test:coverage` | ❌ — existing tests must be augmented to close gaps |
| QUAL-02 | Full-pipeline integration against TS, Python, mixed-language fixtures | integration | `pnpm test` (runs all files including integration/) | ❌ — `tests/integration/pipeline.test.ts` needed |
| QUAL-03 | Snapshot tests for tree renderer output | snapshot | `pnpm test` | ❌ — `tests/renderer/tree-snapshot.test.ts` needed |
| QUAL-04 | E2E MCP server: connect client, call all five tools, verify responses | e2e | `pnpm test` | ❌ — `tests/mcp/e2e.test.ts` needed |

### Sampling Rate
- **Per task commit:** `pnpm test`
- **Per wave merge:** `pnpm test:coverage`
- **Phase gate:** `pnpm test:coverage` exits 0 (all thresholds met) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/fixtures/integration/ts-project/` — 3 static TS files with cross-imports
- [ ] `tests/fixtures/integration/python-project/` — 3 static Python files with cross-imports
- [ ] `tests/fixtures/integration/mixed-project/` — TS + Python files (separate dependency graphs)
- [ ] `tests/integration/pipeline.test.ts` — covers QUAL-02
- [ ] `tests/renderer/tree-snapshot.test.ts` — covers QUAL-03
- [ ] `tests/mcp/e2e.test.ts` — covers QUAL-04 (requires `createGraftServer` extraction)
- [ ] `tests/errors.test.ts` — covers errors.ts coverage gap (QUAL-01)

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `vitest.config.ts`, `package.json`, `pnpm test:coverage` output — coverage
  gaps are directly measured, not estimated
- `tests/mcp/schema-size.test.ts` — InMemoryTransport pattern already proven in this project
- `tests/mcp/server.test.ts` — subprocess E2E pattern already proven
- `tests/integration/stdout.test.ts` — integration subprocess pattern already proven

### Secondary (MEDIUM confidence)
- https://vitest.dev/guide/snapshot — Vitest snapshot API (`toMatchSnapshot`, update workflow,
  `.snap` file location)
- https://vitest.dev/config/#coverage — Coverage provider configuration, threshold options
- @modelcontextprotocol/sdk InMemoryTransport: verified present in `node_modules` at
  `@modelcontextprotocol/sdk/inMemory.js` (already imported in schema-size.test.ts)

### Tertiary (LOW confidence)
- None — all key findings are grounded in the actual codebase state.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, everything measured directly
- Architecture: HIGH — patterns proven in existing test files in this repo
- Pitfalls: HIGH — derived from actual coverage report output and existing code inspection
- Coverage gaps: HIGH — directly from `pnpm test:coverage` output, line numbers exact

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable stack, no moving targets)
