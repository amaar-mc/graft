// Shared indexing pipeline consumed by both CLI commands and MCP tools.
// Single entry point for the discover -> cache check -> parse -> graph -> rank pipeline.

import type { ParseResult } from '../parser/types.js';
import type { FileGraph } from '../graph/types.js';
import { discoverFiles } from './discovery.js';
import { parseFiles } from '../parser/index.js';
import { buildGraph } from '../graph/index.js';
import { computePageRank } from '../graph/pagerank.js';
import { readCache, writeCache, isCacheValid, deserializeResults } from '../cache/index.js';

interface IndexResult {
  readonly graph: FileGraph;
  readonly scores: ReadonlyMap<string, number>;
  readonly files: readonly string[];
  readonly results: readonly ParseResult[];
}

async function buildIndex(
  rootDir: string,
  personalization?: ReadonlyMap<string, number>,
): Promise<IndexResult> {
  const files = await discoverFiles(rootDir);

  const cached = await readCache(rootDir);

  let results: readonly ParseResult[];

  if (cached !== null && (await isCacheValid(cached, rootDir, files))) {
    // Cache hit: deserialize stored results, skip parsing and writing
    results = deserializeResults(cached, rootDir);
  } else {
    // Cache miss or stale: run full parse and persist results
    results = await parseFiles(files);
    await writeCache(rootDir, results, files);
  }

  const graph = buildGraph(results);
  const { scores } = computePageRank(graph, {
    alpha: 0.85,
    maxIterations: 100,
    tolerance: 1e-6,
    personalization,
  });

  return { graph, scores, files, results };
}

export type { IndexResult };
export { buildIndex };
