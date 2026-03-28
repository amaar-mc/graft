#!/usr/bin/env node
// Graft CLI entry point — Commander-based CLI with all five subcommands.
// Only final command output goes to stdout. All logging and spinners use stderr.
// This prevents stdout contamination when running as MCP server.

import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { buildIndex } from '../indexer/pipeline.js';
import { renderTree } from '../renderer/tree.js';
import { transitiveClosure } from '../graph/traversal.js';
import { readCache } from '../cache/index.js';
import { GraftError } from '../errors.js';
import type { NodeKind } from '../parser/types.js';

// ── Version ──────────────────────────────────────────────────────────────────

// Import package.json directly via TypeScript's resolveJsonModule.
// tsup bundles this at build time, so no runtime path resolution needed.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkgJson = require('../../package.json') as { version: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const EXCLUDED_KINDS: ReadonlySet<NodeKind> = new Set(['import', 'export']);

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

// ── Exported handler functions (for testability) ─────────────────────────────

export async function handleMap(
  rootDir: string,
  options: { focus?: string; budget: string; verbose?: boolean },
): Promise<string> {
  const spinner = ora({ text: 'Indexing...', stream: process.stderr }).start();

  let personalization: ReadonlyMap<string, number> | undefined;
  if (options.focus !== undefined) {
    const absPath = path.resolve(rootDir, options.focus);
    personalization = new Map([[absPath, 10.0]]);
  }

  const { graph, scores } = await buildIndex(rootDir, personalization);
  const tokenBudget = parseInt(options.budget, 10);
  if (Number.isNaN(tokenBudget) || tokenBudget < 1) {
    throw new GraftError('Invalid budget value', 'Provide a positive integer for --budget', 'INVALID_INPUT');
  }
  const output = renderTree(graph, scores, rootDir, { tokenBudget, charsPerToken: 3 });

  spinner.succeed(chalk.green(`Indexed ${graph.files.size} files`));

  // If verbose mode is enabled, append PageRank scores to output
  if (options.verbose) {
    const sortedScores = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20); // Show top 20
    const scoreLines = [
      '',
      chalk.bold('PageRank Scores (top 20):'),
      '',
      ...sortedScores.map(([file, score]) => {
        const relPath = path.relative(rootDir, file);
        return `  ${chalk.cyan(relPath)} ${chalk.dim(score.toFixed(6))}`;
      }),
      '',
    ];
    return output + scoreLines.join('\n');
  }

  return output;
}

export async function handleStats(rootDir: string): Promise<string> {
  const spinner = ora({ text: 'Indexing...', stream: process.stderr }).start();

  const { graph } = await buildIndex(rootDir, undefined);

  const fileCount = graph.files.size;

  let defCount = 0;
  for (const [, defs] of graph.definitions) {
    for (const def of defs) {
      if (!EXCLUDED_KINDS.has(def.kind)) {
        defCount++;
      }
    }
  }

  let edgeCount = 0;
  for (const [, edges] of graph.forwardEdges) {
    edgeCount += edges.size;
  }

  const cache = await readCache(rootDir);
  const cacheAge =
    cache !== null && cache.createdAt !== undefined
      ? relativeTime(cache.createdAt)
      : 'No cache';

  spinner.succeed(chalk.green('Stats computed'));

  const lines = [
    chalk.bold('Graft Stats'),
    '',
    `  ${chalk.bold('Files:')}       ${chalk.cyan(String(fileCount))}`,
    `  ${chalk.bold('Definitions:')} ${chalk.cyan(String(defCount))}`,
    `  ${chalk.bold('Edges:')}       ${chalk.cyan(String(edgeCount))}`,
    `  ${chalk.bold('Cache:')}       ${chalk.cyan(cacheAge)}`,
    '',
  ];

  return lines.join('\n');
}

export async function handleImpact(rootDir: string, filePath: string): Promise<string> {
  const spinner = ora({ text: 'Indexing...', stream: process.stderr }).start();

  const absPath = path.resolve(rootDir, filePath);
  const { graph, scores } = await buildIndex(rootDir, undefined);
  const { files: affected } = transitiveClosure(graph, absPath);

  // Sort affected files by score descending
  const sorted = Array.from(affected).sort((a, b) => {
    const scoreA = scores.get(a) ?? 0;
    const scoreB = scores.get(b) ?? 0;
    return scoreB - scoreA;
  });

  spinner.succeed(chalk.green(`Found ${sorted.length} affected files`));

  const lines = [
    chalk.bold(`Impact analysis: ${path.relative(rootDir, absPath)}`),
    chalk.dim(`${sorted.length} affected file${sorted.length === 1 ? '' : 's'}`),
    '',
  ];

  for (const f of sorted) {
    const score = scores.get(f) ?? 0;
    const rel = path.relative(rootDir, f);
    lines.push(`  ${chalk.white(rel)} ${chalk.dim(`[score: ${score.toFixed(4)}]`)}`);
  }

  lines.push('');
  return lines.join('\n');
}

export async function handleSearch(
  rootDir: string,
  query: string,
  options: { kind?: string },
): Promise<string> {
  const spinner = ora({ text: 'Indexing...', stream: process.stderr }).start();

  const { graph } = await buildIndex(rootDir, undefined);

  const matches: Array<{ kind: NodeKind; name: string; relativePath: string; startLine: number }> =
    [];

  for (const [filePath, defs] of graph.definitions) {
    const relativePath = path.relative(rootDir, filePath);
    for (const def of defs) {
      if (!def.name.toLowerCase().includes(query.toLowerCase())) {
        continue;
      }
      if (options.kind !== undefined && def.kind !== options.kind) {
        continue;
      }
      matches.push({ kind: def.kind, name: def.name, relativePath, startLine: def.startLine });
    }
  }

  spinner.succeed(chalk.green(`Found ${matches.length} match${matches.length === 1 ? '' : 'es'}`));

  const lines = [
    chalk.bold(`Search results for "${query}"`),
    chalk.dim(`${matches.length} match${matches.length === 1 ? '' : 'es'}`),
    '',
  ];

  for (const m of matches) {
    lines.push(
      `  ${chalk.yellow(m.kind)} ${chalk.white(m.name)} ${chalk.dim(`in ${m.relativePath}:L${m.startLine}`)}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

// ── Commander setup ───────────────────────────────────────────────────────────

const program = new Command();
program.name('graft').version(pkgJson.version).description('Local-first codebase context engine');

// serve command (CLI-01 + CLI-07): isDefault makes it run when no subcommand given
program
  .command('serve', { isDefault: true })
  .description('Index and start MCP server over stdio')
  .action(async () => {
    // Dynamic import avoids pulling MCP SDK into non-serve commands
    const { startMcpServer } = await import('../mcp/server.js');
    await startMcpServer(process.cwd());
  });

// map command (CLI-02)
program
  .command('map')
  .description('Output ranked codebase tree to stdout')
  .option('--focus <path>', 'File path for personalization')
  .option('--budget <tokens>', 'Token budget for output', '2048')
  .option('--verbose', 'Show PageRank scores in output')
  .action(async (options: { focus?: string; budget: string; verbose?: boolean }) => {
    const output = await handleMap(process.cwd(), options);
    process.stdout.write(output + '\n');
  });

// stats command (CLI-03)
program
  .command('stats')
  .description('Display file count, definition count, edge count, and cache age')
  .action(async () => {
    const output = await handleStats(process.cwd());
    process.stdout.write(output);
  });

// impact command (CLI-04)
program
  .command('impact')
  .description('Show transitively affected files for a given source file')
  .argument('<path>', 'File path to analyze')
  .action(async (filePath: string) => {
    const output = await handleImpact(process.cwd(), filePath);
    process.stdout.write(output);
  });

// search command (CLI-05)
program
  .command('search')
  .description('Find definitions by name with optional kind filter')
  .argument('<query>', 'Name pattern to search for')
  .option('--kind <kind>', 'Filter by definition kind (function, class, type, etc.)')
  .action(async (query: string, options: { kind?: string }) => {
    const output = await handleSearch(process.cwd(), query, options);
    process.stdout.write(output);
  });

// ── Error handling and launch ─────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof GraftError) {
    process.stderr.write(chalk.red(`Error: ${err.message}\n`));
    process.stderr.write(chalk.yellow(`Hint: ${err.hint}\n`));
  } else {
    process.stderr.write(chalk.red(`Error: ${String(err)}\n`));
  }
  process.exit(1);
});
