// MCP server with 5 tools and 2 resources for graft.
// Tools: graft_map, graft_context, graft_search, graft_impact, graft_summary
// Resources: graft://map, graft://file/{path}
// All tool handlers are exported for unit testing in isolation.

import fs from 'fs';
import path from 'path';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import z from 'zod';
import { buildIndex } from '../indexer/pipeline.js';
import { renderTree } from '../renderer/tree.js';
import { forwardDeps, reverseDeps, transitiveClosure } from '../graph/traversal.js';
import type { FileGraph } from '../graph/types.js';
import type { NodeKind } from '../parser/types.js';

// Kinds that are structural noise, excluded from context displays
const EXCLUDED_CONTEXT_KINDS: ReadonlySet<NodeKind> = new Set(['import', 'export']);

// --- Shared context text builder used by graft_context tool and graft://file/{path} resource ---

function buildFileContextText(
  graph: FileGraph,
  scores: ReadonlyMap<string, number>,
  rootDir: string,
  absPath: string,
): string {
  const defs = (graph.definitions.get(absPath) ?? []).filter(
    (d) => !EXCLUDED_CONTEXT_KINDS.has(d.kind),
  );

  const forward = forwardDeps(graph, absPath).files;
  const reverse = reverseDeps(graph, absPath).files;

  const relPath = path.relative(rootDir, absPath);
  const score = scores.get(absPath) ?? 0;

  const lines: string[] = [`# ${relPath} [score: ${score.toFixed(4)}]`, ''];

  // Definitions section
  lines.push('## Definitions');
  if (defs.length === 0) {
    lines.push('(none)');
  } else {
    for (const def of defs) {
      lines.push(`  ${def.kind} ${def.name} (L${def.startLine})`);
    }
  }
  lines.push('');

  // Dependencies section (files this file imports)
  lines.push('## Dependencies');
  if (forward.size === 0) {
    lines.push('(none)');
  } else {
    for (const dep of forward) {
      lines.push(`  ${path.relative(rootDir, dep)}`);
    }
  }
  lines.push('');

  // Dependents section (files that import this file)
  lines.push('## Dependents');
  if (reverse.size === 0) {
    lines.push('(none)');
  } else {
    for (const dep of reverse) {
      lines.push(`  ${path.relative(rootDir, dep)}`);
    }
  }

  return lines.join('\n');
}

// --- Tool handler types ---

interface MapParams {
  readonly query?: string;
  readonly budget?: number;
}

interface PathParam {
  readonly path: string;
}

interface SearchParams {
  readonly query: string;
  readonly kind?: string;
}

// Use SDK's CallToolResult directly so TypeScript overload resolution works correctly
type ContentResponse = CallToolResult;

// --- Tool handlers (exported for unit testing) ---

async function handleGraftMap(params: MapParams, rootDir: string): Promise<ContentResponse> {
  let personalization: ReadonlyMap<string, number> | undefined;

  if (params.query !== undefined) {
    const absPath = path.resolve(rootDir, params.query);
    personalization = new Map([[absPath, 10.0]]);
  }

  const { graph, scores } = await buildIndex(rootDir, personalization);
  const budget = params.budget ?? 2048;
  const text = renderTree(graph, scores, rootDir, { tokenBudget: budget, charsPerToken: 3 });

  return { content: [{ type: 'text' as const, text }] };
}

async function handleGraftContext(
  params: PathParam,
  rootDir: string,
): Promise<ContentResponse> {
  const absPath = path.resolve(rootDir, params.path);
  const { graph, scores } = await buildIndex(rootDir);
  const text = buildFileContextText(graph, scores, rootDir, absPath);

  return { content: [{ type: 'text' as const, text }] };
}

async function handleGraftSearch(params: SearchParams, rootDir: string): Promise<ContentResponse> {
  const { graph } = await buildIndex(rootDir);
  const queryLower = params.query.toLowerCase();

  const matches: string[] = [];

  for (const [filePath, defs] of graph.definitions) {
    const relPath = path.relative(rootDir, filePath);
    for (const def of defs) {
      if (!def.name.toLowerCase().includes(queryLower)) {
        continue;
      }
      if (params.kind !== undefined && def.kind !== params.kind) {
        continue;
      }
      matches.push(`${def.kind} ${def.name} in ${relPath}:L${def.startLine}`);
    }
  }

  const header = `${matches.length} match${matches.length === 1 ? '' : 'es'}`;
  const text = matches.length === 0 ? header : `${header}\n\n${matches.join('\n')}`;

  return { content: [{ type: 'text' as const, text }] };
}

async function handleGraftImpact(params: PathParam, rootDir: string): Promise<ContentResponse> {
  const absPath = path.resolve(rootDir, params.path);
  const { graph, scores } = await buildIndex(rootDir);
  const closure = transitiveClosure(graph, absPath);

  // Sort affected files by score descending
  const sorted = Array.from(closure.files).sort((a, b) => {
    const scoreA = scores.get(a) ?? 0;
    const scoreB = scores.get(b) ?? 0;
    return scoreB - scoreA;
  });

  const lines = sorted.map((file) => {
    const relPath = path.relative(rootDir, file);
    const score = scores.get(file) ?? 0;
    return `${relPath} [score: ${score.toFixed(4)}]`;
  });

  const text = `${lines.length} file${lines.length === 1 ? '' : 's'} affected\n\n${lines.join('\n')}`;

  return { content: [{ type: 'text' as const, text }] };
}

async function handleGraftSummary(
  _params: Record<string, never>,
  rootDir: string,
): Promise<ContentResponse> {
  const { graph, scores } = await buildIndex(rootDir);

  // Compute stats
  const fileCount = graph.files.size;
  let defCount = 0;
  for (const defs of graph.definitions.values()) {
    defCount += defs.length;
  }
  let edgeCount = 0;
  for (const edges of graph.forwardEdges.values()) {
    edgeCount += edges.size;
  }

  // Top 10 files by score
  const sortedFiles = Array.from(graph.files).sort((a, b) => {
    const scoreA = scores.get(a) ?? 0;
    const scoreB = scores.get(b) ?? 0;
    return scoreB - scoreA;
  });
  const topFiles = sortedFiles.slice(0, 10);

  // Detect tech stack from package.json
  let techStackLines: string[];
  try {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkgText = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgText) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    techStackLines = deps.length > 0 ? deps.map((d) => `  ${d}`) : ['  (no dependencies found)'];
  } catch {
    techStackLines = ['  No package.json detected'];
  }

  const lines: string[] = [
    '## Project Stats',
    `  Files: ${fileCount}`,
    `  Definitions: ${defCount}`,
    `  Edges: ${edgeCount}`,
    '',
    '## Key Files',
    ...topFiles.map((f) => {
      const relPath = path.relative(rootDir, f);
      const score = scores.get(f) ?? 0;
      return `  ${relPath} [score: ${score.toFixed(4)}]`;
    }),
    '',
    '## Tech Stack',
    ...techStackLines,
  ];

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}

// --- MCP server factory ---

// Creates a fully configured McpServer with all tools and resources registered.
// Does NOT connect a transport — callers use this for in-process testing with InMemoryTransport.
function createGraftServer(rootDir: string): McpServer {
  const server = new McpServer({ name: 'graft', version: '0.0.1' });

  // Tool: graft_map
  server.tool(
    'graft_map',
    'Ranked tree map of the codebase by structural importance.',
    {
      query: z.string().optional().describe('File or symbol for personalization'),
      budget: z
        .number()
        .int()
        .min(1)
        .max(32000)
        .optional()
        .describe('Max tokens (default 2048)'),
    },
    async (params) => handleGraftMap(params, rootDir),
  );

  // Tool: graft_context
  server.tool(
    'graft_context',
    'Dependencies and definitions for a specific file.',
    {
      path: z.string().describe('File path relative to project root'),
    },
    async (params) => handleGraftContext(params, rootDir),
  );

  // Tool: graft_search
  server.tool(
    'graft_search',
    'Find definitions by name or kind.',
    {
      query: z.string().describe('Name pattern to search for'),
      kind: z.string().optional().describe('Filter by kind: function, class, type, etc.'),
    },
    async (params) => handleGraftSearch(params, rootDir),
  );

  // Tool: graft_impact
  server.tool(
    'graft_impact',
    'Files affected by changing a given file.',
    {
      path: z.string().describe('File path relative to project root'),
    },
    async (params) => handleGraftImpact(params, rootDir),
  );

  // Tool: graft_summary
  server.tool(
    'graft_summary',
    'Project overview with key files and tech stack.',
    {},
    async (params) => handleGraftSummary(params as Record<string, never>, rootDir),
  );

  // Resource: graft://map (static)
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

  // Resource: graft://file/{path} (parameterized)
  server.resource(
    'file',
    new ResourceTemplate('graft://file/{path}', { list: undefined }),
    { description: 'File with its dependency relationships' },
    async (uri, { path: filePath }) => {
      const absPath = path.resolve(rootDir, filePath as string);
      const { graph, scores } = await buildIndex(rootDir);
      const text = buildFileContextText(graph, scores, rootDir, absPath);
      return { contents: [{ uri: uri.href, text, mimeType: 'text/plain' }] };
    },
  );

  return server;
}

// --- MCP server entry point ---

async function startMcpServer(rootDir: string): Promise<void> {
  const server = createGraftServer(rootDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export {
  startMcpServer,
  createGraftServer,
  buildFileContextText,
  handleGraftMap,
  handleGraftContext,
  handleGraftSearch,
  handleGraftImpact,
  handleGraftSummary,
};
