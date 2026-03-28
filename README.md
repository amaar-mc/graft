<p align="center">
  <img src="assets/logo.png" alt="Graft" width="120" />
</p>

<h1 align="center">Graft</h1>

<p align="center">
  <strong>Local-first codebase context engine for AI coding tools</strong>
</p>

<p align="center">
  Parse any codebase into a ranked dependency graph. Serve it to AI tools via MCP.<br/>
  Zero config. Zero cloud. Nothing leaves your machine.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/graftmap"><img src="https://img.shields.io/npm/v/graftmap?color=blue" alt="npm version" /></a>
  <a href="https://github.com/amaar-mc/graft/actions"><img src="https://github.com/amaar-mc/graft/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/amaar-mc/graft/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node.js" /></a>
</p>

---

## Why Graft?

AI coding tools are only as good as the context they receive. Most tools either have no codebase understanding, or use proprietary indexing locked to a single editor.

Graft gives **any** MCP-compatible AI tool deep structural understanding of your codebase:

- **100K lines of code** represented in **~2K tokens** of ranked context
- **Dependency-aware** — knows which files import what, and what depends on what
- **PageRank-scored** — surfaces the most structurally important files first
- **Tool-agnostic** — works with Claude, Cursor, Windsurf, Continue, or any MCP client
- **Local-first** — no cloud, no telemetry, no code ever leaves your machine

```
$ npx graftmap map

src/indexer/pipeline.ts [score: 0.0842]
  function buildIndex (L19)

src/graph/pagerank.ts [score: 0.0731]
  function computePageRank (L52)
  function buildTeleportVector (L11)

src/parser/index.ts [score: 0.0654]
  function parseFiles (L28)

src/mcp/server.ts [score: 0.0612]
  function createGraftServer (L238)
  function startMcpServer (L327)

[~487 tokens]
```

## Quick Start

```bash
# Run instantly with npx (no install needed)
npx graftmap map

# Or install globally
npm install -g graftmap
graft map
```

## MCP Integration

Add Graft to your AI tool's MCP configuration. Once connected, your AI assistant automatically gets ranked codebase context.

### Claude Desktop / Claude Code

Add to your MCP settings:

```json
{
  "mcpServers": {
    "graft": {
      "command": "npx",
      "args": ["-y", "graftmap"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "graft": {
      "command": "npx",
      "args": ["-y", "graftmap"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Any MCP Client

Graft speaks standard MCP over stdio. Point any MCP-compatible client at `npx graftmap` and it works.

## MCP Tools

Once connected, your AI tool gets these capabilities:

| Tool | Description |
|------|-------------|
| `graft_map` | Ranked tree map of the codebase by structural importance |
| `graft_context` | Dependencies and definitions for a specific file |
| `graft_search` | Find definitions by name or kind (function, class, type, etc.) |
| `graft_impact` | Files affected by changing a given file |
| `graft_summary` | Project overview with key files and tech stack |

Plus two MCP resources: `graft://map` and `graft://file/{path}`

## CLI Commands

```bash
graft map                    # Ranked codebase tree
graft map --focus src/api.ts # Personalized view focused on a file
graft map --budget 4096      # Custom token budget
graft stats                  # File count, definitions, edges, cache age
graft impact src/auth.ts     # What breaks if you change this file?
graft search "handleRequest" # Find definitions by name
graft search "User" --kind class  # Filter by kind
graft serve                  # Start MCP server (default command)
```

## How It Works

```
Your Codebase          Graft Pipeline              AI Tool
─────────────          ──────────────              ───────
  .ts .js .py    ──►   tree-sitter AST
                        extraction
                             │
                        dependency graph     ──►   graft_map
                        construction               graft_context
                             │                     graft_search
                        personalized         ──►   graft_impact
                        PageRank scoring           graft_summary
                             │
                        token-budgeted       ──►   Ranked context
                        rendering                  in ~2K tokens
```

1. **Discover** — finds all supported files, respects `.gitignore`
2. **Parse** — extracts definitions (functions, classes, types) and references using tree-sitter
3. **Graph** — builds a directed dependency graph (files as nodes, imports as edges)
4. **Rank** — runs personalized PageRank to score files by structural importance
5. **Render** — produces token-budgeted output that fits in any AI context window
6. **Cache** — stores results in `.graft/cache.json` for instant re-indexing

## Supported Languages

| Language | Definitions | References | Status |
|----------|------------|------------|--------|
| TypeScript | Functions, classes, interfaces, types, enums, methods | Imports, usages | Stable |
| JavaScript | Functions, classes, methods | Imports, usages | Stable |
| TSX/JSX | Same as TS/JS | Same as TS/JS | Stable |
| Python | Functions, classes, methods, decorators, dataclasses | Imports, usages | Stable |
| Go | — | — | Planned |
| Rust | — | — | Planned |

## Performance

Graft is designed for large codebases:

- **Caching** — parses once, re-indexes only changed files
- **Token-efficient** — 100K LOC → ~2K tokens of meaningful context
- **Fast** — full index of a medium codebase in under 3 seconds
- **Memory-efficient** — in-memory graph, no external database needed

## Configuration

Graft is zero-config by default. It automatically:

- Discovers `.ts`, `.tsx`, `.js`, `.jsx`, and `.py` files
- Respects `.gitignore` patterns
- Excludes `node_modules`, `dist`, `.git`, and common build directories
- Uses sensible defaults for token budgets and PageRank parameters

No config files needed. Ever.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

Especially interested in:
- **New language support** (Go, Rust, Java, C#, Ruby)
- **Performance optimizations** for very large monorepos
- **MCP tool improvements** and new tool ideas
- **Integration guides** for more AI coding tools

## License

[MIT](LICENSE) — use it anywhere, for anything.

---

<p align="center">
  Built by <a href="https://github.com/amaar-mc">Amaar Chughtai</a><br/>
  Give your AI tools the context they deserve.
</p>
