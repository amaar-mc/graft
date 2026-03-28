# Phase 3: CLI + MCP — Research

**Researched:** 2026-03-28
**Domain:** MCP server (stdio transport) + Commander.js CLI + CJS bundling
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLI-01 | `graft serve` command starts MCP server over stdio | commander subcommand → `serve` action calls `startMcpServer()` |
| CLI-02 | `graft map` command outputs ranked tree map with optional `--focus` flag | commander subcommand → calls `renderTree()` from Phase 2 renderer |
| CLI-03 | `graft stats` command shows indexing statistics | commander subcommand → reads cache metadata |
| CLI-04 | `graft impact <path>` shows files affected by changing path | commander subcommand with required argument → calls `transitiveClosure()` |
| CLI-05 | `graft search <query>` finds definitions with optional `--kind` filter | commander subcommand with required argument and option → searches graph definitions |
| CLI-06 | Beautiful terminal output: chalk colors, tree characters, progress spinners (ora) | chalk@4.1.2 (CJS) + ora@5.4.1 (CJS) — both confirmed non-ESM |
| CLI-07 | `npx graft` with no args indexes and starts MCP server | commander `isDefault: true` on the serve subcommand |
| MCP-01 | MCP server using @modelcontextprotocol/sdk with stdio transport | `McpServer` + `StdioServerTransport` from SDK — CJS exports confirmed |
| MCP-02 | `graft_map` tool with optional `query` and `budget` params | `server.tool()` or `server.registerTool()` with Zod v3 schema |
| MCP-03 | `graft_context` tool — file path/symbol → subgraph (deps + reverse + siblings) | compose `forwardDeps()` + `reverseDeps()` + `definitions.get()` |
| MCP-04 | `graft_search` tool — structural search by name/kind/pattern | filter `graph.definitions` by name match or kind |
| MCP-05 | `graft_impact` tool — transitive reverse-dep closure | calls `transitiveClosure()` from Phase 2 |
| MCP-06 | `graft_summary` tool — project overview with modules, entry points, tech stack | derive from PageRank top-N + graph structure |
| MCP-07 | `graft://map` MCP resource — full ranked tree | `server.resource('map', 'graft://map', ...)` |
| MCP-08 | `graft://file/{path}` MCP resource — contextual file view | `new ResourceTemplate('graft://file/{path}', ...)` |
| MCP-09 | Total MCP tool schema serialization < 4,000 characters | enforce at design time via concise descriptions |
</phase_requirements>

---

## Summary

Phase 3 connects the graph + rendering engine built in Phases 1-2 to two consumer surfaces: a human-facing CLI and a machine-facing MCP server. The core computation (parse, graph, PageRank, render) is already implemented. This phase is primarily wiring.

The MCP server uses `@modelcontextprotocol/sdk` v1.28.0. That SDK ships a proper `dist/cjs/` tree — the CJS stdio transport is clean, no top-level await, no ESM-only deps. The SSEClientTransport (which has historical CJS bundling issues) is never imported, so tsup's CJS bundle mode works without special configuration.

The CLI uses commander v14 with chalk v4.1.2 and ora v5.4.1. Chalk 5+ and ora 9+ are ESM-only; these older versions are the last CJS-compatible releases. The project's existing tsup config (`format: ['cjs']`) handles them correctly.

Zod must remain on v3.x (locked decision). MCP SDK 1.28's peerDep is `zod ^3.25 || ^4.0` and the CJS bundle imports from `zod` (v3 API) internally — safe with Zod 3.25.x.

**Primary recommendation:** Install `@modelcontextprotocol/sdk@^1.28`, `zod@^3.25`, `commander@^14`, `chalk@^4`, `ora@^5`. Wire all five MCP tools and two resources in `src/mcp/server.ts`, then wire the CLI entry point through commander in a refactored `src/cli/index.ts`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | 1.28.0 | MCP protocol server | Official Anthropic SDK, ships CJS, peerDep Zod v3/v4 |
| zod | 3.25.x | Input schema validation for MCP tools | Locked decision — v4 crashes older SDK versions at runtime |
| commander | 14.0.3 | CLI argument parsing | De-facto standard, dual CJS/ESM, supports `isDefault` subcommands |
| chalk | 4.1.2 | Terminal colors | Last CJS-compatible major; chalk 5+ is ESM-only |
| ora | 5.4.1 | Progress spinners | Last CJS-compatible major; ora 6+ is ESM-only |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | All graph/renderer/cache APIs from Phase 2 | Already in repo |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chalk@4 | picocolors | picocolors is smaller but chalk's API is far richer; cost is negligible |
| ora@5 | cli-spinners directly | ora composes animation loop + stream management; not worth building manually |
| commander@14 | yargs | commander is lighter and types are excellent; yargs is heavier |

### Installation
```bash
pnpm add @modelcontextprotocol/sdk@^1.28 zod@^3.25 commander@^14 chalk@^4 ora@^5
pnpm add -D @types/node
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── cli/
│   └── index.ts          # Commander program, all subcommands, default action
├── mcp/
│   └── server.ts         # McpServer construction, all 5 tools, 2 resources
├── graph/                # Phase 2 — unchanged
├── renderer/             # Phase 2 — unchanged
├── cache/                # Phase 2 — unchanged
├── indexer/              # Phase 1 — unchanged
├── parser/               # Phase 1 — unchanged
├── logger.ts             # Phase 1 — unchanged
└── errors.ts             # Phase 1 — unchanged
```

### Pattern 1: MCP Server — Minimal stdio startup

**What:** Create McpServer, register all tools and resources, connect via StdioServerTransport.
**When to use:** Any time MCP server mode is launched (both `graft serve` and `npx graft` default).

```typescript
// Source: verified from @modelcontextprotocol/sdk dist/cjs/server/stdio.js + mcp.js
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import z from 'zod';

async function startMcpServer(rootDir: string): Promise<void> {
  const server = new McpServer({ name: 'graft', version: '0.0.1' });

  // Register tools (see Tool Registration Pattern below)
  registerGraftTools(server, rootDir);
  registerGraftResources(server, rootDir);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // server.connect() does NOT block indefinitely on its own.
  // stdin data events keep the process alive as long as the client holds the pipe.
}
```

### Pattern 2: MCP Tool Registration with Zod v3

**What:** Register a tool with `server.tool()` (shorthand) using a Zod v3 `z.object()` raw shape.
**When to use:** All five graft tools.

```typescript
// Source: verified from dist/cjs/server/mcp.js — tool() accepts raw Zod shape
server.tool(
  'graft_map',
  'Return a ranked tree map of the codebase, sorted by structural importance. Use query to personalize.',
  {
    query: z.string().optional().describe('Focal file path or symbol name for personalization'),
    budget: z.number().int().min(1).max(32000).optional().describe('Max tokens to return (default 2048)'),
  },
  async ({ query, budget }) => {
    // ... implementation
    return { content: [{ type: 'text', text: treeOutput }] };
  },
);
```

**Key note:** `server.tool(name, description, zodRawShape, handler)` is the four-argument overload. The raw shape (`{ key: z.type() }`) is NOT a `z.object()` — it is a plain object whose values are Zod schemas. This is confirmed in the SDK source (`isZodRawShapeCompat` check).

### Pattern 3: MCP Resource Registration

**What:** Static resource for `graft://map`, parameterized ResourceTemplate for `graft://file/{path}`.
**When to use:** MCP-07 and MCP-08.

```typescript
// Static resource — graft://map
server.resource(
  'map',
  'graft://map',
  { description: 'Full ranked tree map of the codebase' },
  async (_uri) => {
    const treeOutput = await buildMapOutput(rootDir);
    return { contents: [{ uri: 'graft://map', text: treeOutput, mimeType: 'text/plain' }] };
  },
);

// Parameterized resource — graft://file/{path}
server.resource(
  'file',
  new ResourceTemplate('graft://file/{path}', { list: undefined }),
  { description: 'Contextual view of a specific file with its dependency relationships' },
  async (uri, { path: filePath }) => {
    const contextOutput = await buildFileContext(rootDir, filePath as string);
    return { contents: [{ uri: uri.href, text: contextOutput, mimeType: 'text/plain' }] };
  },
);
```

### Pattern 4: Commander CLI with Default Subcommand

**What:** Set the `serve` command as the default action when no subcommand is given.
**When to use:** CLI-07 — `npx graft` with no args must start MCP server.

```typescript
// Source: commander v14 docs — isDefault: true on a subcommand
import { Command } from 'commander';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));
const program = new Command();

program
  .name('graft')
  .version(pkg.version)
  .description('Local-first codebase context engine');

program
  .command('serve', { isDefault: true })
  .description('Index current directory and start MCP server over stdio')
  .action(async () => {
    await startMcpServer(process.cwd());
  });

program
  .command('map')
  .description('Output ranked tree map to stdout')
  .option('--focus <path>', 'Personalize output around a file path')
  .option('--budget <tokens>', 'Max tokens to output', '2048')
  .action(async (options) => { /* ... */ });

program.parseAsync(process.argv);
```

**Note:** `isDefault: true` means `graft` with no args runs the `serve` command. `graft serve` also works explicitly.

### Pattern 5: Spinner + Colored CLI Output

**What:** Show progress spinner during indexing, then render tree with colored output. All goes to stderr when in server mode.
**When to use:** CLI-06 — `graft map`, `graft stats`, `graft impact`, `graft search`.

```typescript
import chalk from 'chalk';
import ora from 'ora';

// Chalk 4 import style — default import works with CJS
const spinner = ora({ text: 'Indexing...', stream: process.stderr }).start();
// ... do work
spinner.succeed(chalk.green('Indexed 142 files'));

// Tree characters for output
const TREE_BRANCH = '├── ';
const TREE_LAST   = '└── ';
const TREE_INDENT = '│   ';
```

**Critical:** Pass `stream: process.stderr` to ora. Default stream is stdout — contamination risk in MCP mode.

### Pattern 6: Shared Indexing Pipeline

**What:** Both CLI and MCP tools need the same parse → graph → PageRank pipeline. Extract to a single shared helper.
**When to use:** All MCP tools and all CLI commands.

```typescript
// src/indexer/pipeline.ts (new file)
async function buildIndex(rootDir: string): Promise<{
  graph: FileGraph;
  scores: ReadonlyMap<string, number>;
  files: readonly string[];
}> {
  const files = await discoverFiles(rootDir);
  // Cache-aware parse (readCache → isCacheValid → parseFiles → writeCache)
  const results = await getOrParseFiles(rootDir, files);
  const graph = buildGraph(results);
  const { scores } = computePageRank(graph, { alpha: 0.85, maxIterations: 100, tolerance: 1e-6 });
  return { graph, scores, files };
}
```

### Anti-Patterns to Avoid

- **console.log in MCP mode:** Any `console.log` writes to stdout and corrupts JSON-RPC. All logging must use `logger.ts` (stderr). This is already enforced but must stay enforced in all new MCP tool handlers.
- **Importing SSEClientTransport:** Only import `@modelcontextprotocol/sdk/server/mcp.js` and `@modelcontextprotocol/sdk/server/stdio.js`. The SSE client transport has CJS bundling issues with top-level await — it is client-facing and never needed here.
- **z.object() in tool schema:** Use raw Zod shape `{ key: z.type() }` not `z.object({ key: z.type() })` in `server.tool()`. Both work but raw shape is the documented pattern.
- **chalk/ora v5+:** Do not upgrade chalk or ora past their CJS-compatible versions. chalk@5 and ora@6+ are ESM-only.
- **Blocking on server.connect():** `await server.connect(transport)` does not block the process — the stdin data listener keeps Node alive. Do not add `setInterval` or `process.stdin.resume()` unless testing shows the process exits prematurely (unlikely with stdin listener present).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON-RPC framing over stdio | Custom message parser | `StdioServerTransport` | Length-prefix framing, buffer management, stream backpressure |
| Tool schema → JSON Schema | Manual JSON Schema objects | `server.tool()` with Zod | SDK converts Zod to JSON Schema automatically |
| URI template matching for `graft://file/{path}` | Manual regex | `ResourceTemplate` | RFC 6570 compliant; SDK handles param extraction |
| CLI argument parsing | `process.argv` slicing | commander | Sub-commands, help generation, error messages, type coercion |
| Progress animation loop | Custom `setInterval` | ora | Handles TTY detection, stream selection, graceful cleanup |

**Key insight:** The MCP protocol has significant framing and serialization complexity that the SDK fully handles. The only business logic in Phase 3 is calling existing Phase 2 APIs and formatting their output as text content.

---

## Common Pitfalls

### Pitfall 1: stdout contamination from chalk or ora
**What goes wrong:** If ora's default stream (stdout) is used in MCP mode, spinner frames appear in the JSON-RPC stream and corrupt the session silently. Claude Code disconnects with no error message.
**Why it happens:** ora defaults to `process.stdout`. chalk never touches streams directly (it just returns strings), but `console.log(chalk.green(...))` would write to stdout.
**How to avoid:** Pass `{ stream: process.stderr }` to every ora call. Never use `console.log` or `process.stdout.write` anywhere in MCP or CLI code — use `logger.ts`.
**Warning signs:** MCP client receives garbled JSON-RPC, parse errors on first tool call.

### Pitfall 2: MCP tool schema total size > 4,000 characters
**What goes wrong:** MCP-09 requires total schema serialization under 4,000 characters. Five tools with verbose descriptions easily exceed this.
**Why it happens:** MCP clients often include all tool schemas in the LLM context on every request. Bloated schemas eat token budget.
**How to avoid:** Write short, single-sentence descriptions. Keep parameter descriptions under 60 characters each. Measure `JSON.stringify(toolSchemas).length` in a test.
**Warning signs:** Schema serialization test fails; LLM context costs spike.

### Pitfall 3: Zod v4 installed inadvertently
**What goes wrong:** `pnpm add zod` without version pin installs Zod v4.x. The MCP SDK's internal compatibility shim handles v4 but the project has locked v3 — this is a runtime surprise waiting to happen if someone upgrades.
**Why it happens:** npm/pnpm resolves `zod@^3.25 || ^4.0` peerDep to latest unless pinned.
**How to avoid:** Pin `"zod": "^3.25"` in `package.json` dependencies (not peerDeps). Add a comment.
**Warning signs:** `pnpm list zod` shows 4.x.

### Pitfall 4: Commander exits process before MCP connection
**What goes wrong:** If the commander action handler returns a Promise but `program.parse()` is used instead of `program.parseAsync()`, commander calls the action without awaiting it. The process may exit before the MCP server connects.
**Why it happens:** `program.parse()` does not await async action handlers.
**How to avoid:** Use `program.parseAsync(process.argv)` at the CLI entry point.
**Warning signs:** MCP server starts but immediately disconnects; `graft serve` works inconsistently.

### Pitfall 5: package.json path loading in bundled CJS
**What goes wrong:** Reading package.json for version string using `new URL('../../package.json', import.meta.url)` fails in CJS bundles because `import.meta.url` is not available in CJS.
**Why it happens:** The project uses `format: ['cjs']` in tsup.
**How to avoid:** Use `require.resolve` or a hardcoded version string. Alternatively, read package.json via `fs.readFileSync(path.join(__dirname, '../../package.json'))` — `__dirname` is available in CJS.
**Warning signs:** Build error or runtime crash at version string read.

### Pitfall 6: MCP SDK ESM-only dependency surface
**What goes wrong:** Importing from `@modelcontextprotocol/sdk` (bare specifier) may pull in auth/SSE surface that uses ESM-only deps (`pkce-challenge`).
**Why it happens:** Older SDK versions had pkce-challenge issues in CJS context. SDK 1.28 ships proper CJS but the risk is import path selection.
**How to avoid:** Import exclusively from `@modelcontextprotocol/sdk/server/mcp.js` and `@modelcontextprotocol/sdk/server/stdio.js`. Confirmed both files in `dist/cjs/` are clean CJS with no top-level await and no ESM-only deps.
**Warning signs:** tsup build error: "Top-level await is currently not supported with the 'cjs' output format."

---

## Code Examples

### Complete MCP Server Setup
```typescript
// src/mcp/server.ts
// Source: verified against @modelcontextprotocol/sdk@1.28.0 dist/cjs/server/mcp.js
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import z from 'zod';
import { buildIndex } from '../indexer/pipeline.js';
import { renderTree } from '../renderer/tree.js';
import { transitiveClosure } from '../graph/traversal.js';

async function startMcpServer(rootDir: string): Promise<void> {
  const server = new McpServer({ name: 'graft', version: '0.0.1' });

  server.tool(
    'graft_map',
    'Ranked tree map of the codebase sorted by structural importance.',
    {
      query: z.string().optional().describe('File path or symbol for personalization'),
      budget: z.number().int().min(1).max(32000).optional().describe('Max tokens (default 2048)'),
    },
    async ({ query, budget }) => {
      const { graph, scores } = await buildIndex(rootDir);
      const output = renderTree(graph, scores, rootDir, {
        tokenBudget: budget ?? 2048,
        charsPerToken: 3,
      });
      return { content: [{ type: 'text', text: output }] };
    },
  );

  // ... additional tools

  server.resource(
    'map',
    'graft://map',
    { description: 'Full ranked codebase tree map' },
    async (_uri) => {
      const { graph, scores } = await buildIndex(rootDir);
      const text = renderTree(graph, scores, rootDir, { tokenBudget: 8192, charsPerToken: 3 });
      return { contents: [{ uri: 'graft://map', text, mimeType: 'text/plain' }] };
    },
  );

  server.resource(
    'file',
    new ResourceTemplate('graft://file/{path}', { list: undefined }),
    { description: 'File with its dependency context' },
    async (uri, { path: filePath }) => {
      const { graph, scores } = await buildIndex(rootDir);
      // Compose forward deps + reverse deps + own definitions
      const text = buildFileContextText(graph, scores, rootDir, filePath as string);
      return { contents: [{ uri: uri.href, text, mimeType: 'text/plain' }] };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

### Commander CLI Entry Point
```typescript
// src/cli/index.ts (replacement)
// Source: commander v14 docs — isDefault + parseAsync
import { Command } from 'commander';
import path from 'path';
import { readFileSync } from 'fs';

const pkgJson = JSON.parse(
  readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'),
) as { version: string };

const program = new Command();
program.name('graft').version(pkgJson.version);

program
  .command('serve', { isDefault: true })
  .description('Index current directory and start MCP server over stdio')
  .action(async () => {
    const { startMcpServer } = await import('../mcp/server.js');
    await startMcpServer(process.cwd());
  });

program
  .command('map')
  .description('Print ranked tree map')
  .option('--focus <path>', 'Personalize around a file path')
  .option('--budget <tokens>', 'Token budget', '2048')
  .action(async (options: { focus?: string; budget: string }) => { /* ... */ });

program
  .command('impact')
  .description('Show files affected by changing a file')
  .argument('<path>', 'File path to analyze')
  .action(async (filePath: string) => { /* ... */ });

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`Error: ${String(err)}\n`);
  process.exit(1);
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `server.setRequestHandler()` directly | `server.tool()` / `server.registerTool()` | SDK ~1.5 | Much simpler — no raw JSON Schema construction |
| Zod v4 with MCP SDK | Zod v3 (project locked) | N/A (project decision) | Avoid runtime crash from internal API mismatch |
| chalk v5+ (ESM) | chalk v4 (CJS) | chalk v5 dropped CJS | Required for tsup CJS output |
| ora v6+ (ESM) | ora v5 (CJS) | ora v6 dropped CJS | Required for tsup CJS output |

**Deprecated/outdated:**
- `server.setRequestHandler(ListToolsRequestSchema, ...)` — low-level; replaced by `server.tool()` in modern SDK
- SSEServerTransport — deprecated in favor of StreamableHTTPServerTransport; irrelevant since we use stdio

---

## Open Questions

1. **`graft_context` subgraph boundary**
   - What we know: `forwardDeps()`, `reverseDeps()`, `definitions.get()` exist and are the building blocks
   - What's unclear: How deep should the subgraph go — direct deps only, or 2-hops?
   - Recommendation: Direct deps only (1-hop forward + 1-hop reverse). Keeps output bounded without a depth param.

2. **`graft_summary` tech stack detection**
   - What we know: Graph has all file paths and definitions. package.json exists at rootDir.
   - What's unclear: How to detect "tech stack" without reading package.json at parse time
   - Recommendation: Read `rootDir/package.json` if it exists, extract `dependencies` keys. Simple heuristic — no new infrastructure needed.

3. **MCP client keep-alive on reconnect**
   - What we know: STATE.md flagged "MCP client keep-alive semantics on disconnect/reconnect not fully specified — needs live test against Claude Code before Phase 3 ships"
   - What's unclear: Whether stdio transport keeps process alive when client reconnects after disconnect
   - Recommendation: Stdio transport naturally stays alive via stdin listener. The blocker is more about Claude Code's reconnect UI behavior (an issue tracker item), not our server behavior. The server implementation is standard and correct.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest@4.1.2 |
| Config file | vitest.config.ts (root) |
| Quick run command | `pnpm test -- tests/mcp tests/cli` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLI-01 | `graft serve` starts MCP server | integration | `pnpm test -- tests/cli/serve.test.ts` | Wave 0 |
| CLI-02 | `graft map` outputs tree with --focus | unit | `pnpm test -- tests/cli/map.test.ts` | Wave 0 |
| CLI-03 | `graft stats` shows correct counts | unit | `pnpm test -- tests/cli/stats.test.ts` | Wave 0 |
| CLI-04 | `graft impact <path>` shows affected files | unit | `pnpm test -- tests/cli/impact.test.ts` | Wave 0 |
| CLI-05 | `graft search <query>` filters by name/kind | unit | `pnpm test -- tests/cli/search.test.ts` | Wave 0 |
| CLI-06 | spinner stream is stderr not stdout | unit (spy) | `pnpm test -- tests/cli/stdout.test.ts` | Wave 0 |
| CLI-07 | no-args default routes to serve | unit | `pnpm test -- tests/cli/default.test.ts` | Wave 0 |
| MCP-01 | McpServer connects via stdio | integration | `pnpm test -- tests/mcp/server.test.ts` | Wave 0 |
| MCP-02 | graft_map returns text content | unit | `pnpm test -- tests/mcp/tools.test.ts` | Wave 0 |
| MCP-03 | graft_context returns subgraph | unit | `pnpm test -- tests/mcp/tools.test.ts` | Wave 0 |
| MCP-04 | graft_search filters correctly | unit | `pnpm test -- tests/mcp/tools.test.ts` | Wave 0 |
| MCP-05 | graft_impact returns closure | unit | `pnpm test -- tests/mcp/tools.test.ts` | Wave 0 |
| MCP-06 | graft_summary returns project overview | unit | `pnpm test -- tests/mcp/tools.test.ts` | Wave 0 |
| MCP-07 | graft://map resource returns tree | unit | `pnpm test -- tests/mcp/resources.test.ts` | Wave 0 |
| MCP-08 | graft://file/{path} returns file context | unit | `pnpm test -- tests/mcp/resources.test.ts` | Wave 0 |
| MCP-09 | total schema size < 4000 chars | unit | `pnpm test -- tests/mcp/schema-size.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- tests/mcp tests/cli`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green + `pnpm typecheck` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/mcp/tools.test.ts` — covers MCP-02 through MCP-06
- [ ] `tests/mcp/resources.test.ts` — covers MCP-07, MCP-08
- [ ] `tests/mcp/schema-size.test.ts` — covers MCP-09
- [ ] `tests/mcp/server.test.ts` — covers MCP-01 (integration: spawn server, send init, verify response)
- [ ] `tests/cli/stdout.test.ts` — covers CLI-06 (extend existing stdout.test.ts pattern)
- [ ] `tests/cli/serve.test.ts` — covers CLI-01
- [ ] `tests/cli/map.test.ts` — covers CLI-02
- [ ] `tests/cli/stats.test.ts` — covers CLI-03
- [ ] `tests/cli/impact.test.ts` — covers CLI-04
- [ ] `tests/cli/search.test.ts` — covers CLI-05
- [ ] `tests/cli/default.test.ts` — covers CLI-07
- [ ] `src/indexer/pipeline.ts` — shared indexing helper (new file needed by both CLI and MCP)

---

## Sources

### Primary (HIGH confidence)
- `@modelcontextprotocol/sdk@1.28.0` — unpacked and read `dist/cjs/server/stdio.js` and `dist/cjs/server/mcp.js` directly; confirmed CJS-clean, no top-level await, no ESM-only deps in stdio path
- `dist/cjs/server/mcp.js` source — confirmed `McpServer`, `ResourceTemplate` exports; verified `tool()` 4-argument overload (name, description, rawShape, handler) and `resource()` with `ResourceTemplate`
- Project source files — read all Phase 2 APIs: `renderTree`, `renderJson`, `computePageRank`, `buildGraph`, `transitiveClosure`, `forwardDeps`, `reverseDeps`, `discoverFiles`, cache module, logger

### Secondary (MEDIUM confidence)
- [MCP TypeScript SDK docs — server.md](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) — confirmed McpServer, StdioServerTransport, ResourceTemplate import paths and usage patterns
- [MCP SDK API reference](https://ts.sdk.modelcontextprotocol.io/documents/server.html) — confirmed method signatures for `registerTool()` and `registerResource()`
- npm metadata — confirmed chalk@4.1.2 has no `type: module` field (CJS); chalk@5+ has `"type": "module"` (ESM-only); same for ora@5.4.1 vs ora@6+

### Tertiary (LOW confidence)
- [MCP SDK Zod issue #925](https://github.com/modelcontextprotocol/typescript-sdk/issues/925) — Zod v4 incompatibility is resolved in SDK 1.23+; SDK 1.28 peerDep is `^3.25 || ^4.0` (cross-verified with npm info)
- [CJS top-level await issue #213](https://github.com/modelcontextprotocol/typescript-sdk/issues/213) — SSEClientTransport has CJS bundling issues; stdio transport is unaffected (verified by reading actual CJS file)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm metadata confirmed; MCP SDK CJS files read directly
- Architecture: HIGH — Phase 2 APIs read directly from source; MCP SDK API verified from compiled CJS
- Pitfalls: HIGH — stdout contamination verified from existing test patterns; Zod v3/v4 issue cross-verified; chalk/ora CJS status confirmed via npm info

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (MCP SDK moves fast; re-verify if upgrading past 1.28)
