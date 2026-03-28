#!/usr/bin/env node
// Graft CLI entry point — wires discoverFiles and parseFiles into a functional pipeline.
// All output goes to stderr; stdout is reserved for MCP JSON-RPC in Phase 3.

import path from 'path';
import { discoverFiles } from '../indexer/discovery.js';
import { parseFiles } from '../parser/index.js';
import { info, error } from '../logger.js';
import { GraftError } from '../errors.js';
import type { ParseResult } from '../parser/types.js';

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const startMs = Date.now();

  info('Starting graft', { rootDir });

  const files = await discoverFiles(rootDir);

  if (files.length === 0) {
    info('No source files discovered — nothing to parse', { rootDir });
    return;
  }

  const results: readonly ParseResult[] = await parseFiles(files);

  const totalNodes = results.reduce((sum, r) => sum + r.nodes.length, 0);
  const elapsed = Date.now() - startMs;

  info('Summary', { files: results.length, nodes: totalNodes, elapsed_ms: elapsed });

  // Print top-level definitions to stderr: name, kind, relative file path
  for (const result of results) {
    const relativePath = path.relative(rootDir, result.filePath);
    for (const node of result.nodes) {
      process.stderr.write(`  ${node.kind.padEnd(12)} ${node.name.padEnd(40)} ${relativePath}\n`);
    }
  }
}

main().catch((err: unknown) => {
  if (err instanceof GraftError) {
    error(`${err.message} — ${err.hint}`, { code: err.code });
  } else {
    error('Unexpected error', { message: String(err) });
  }
  process.exit(1);
});
