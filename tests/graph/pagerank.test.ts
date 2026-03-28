import { describe, it, expect } from 'vitest';
import { computePageRank } from '../../src/graph/pagerank.js';
import type { FileGraph, PageRankOptions } from '../../src/graph/types.js';

// Build a FileGraph from an array of directed edge pairs [importer, imported].
// In the dependency graph: A imports B means A -> B in forwardEdges, so B is "upstream" (higher rank).
function makeGraph(edges: [string, string][]): FileGraph {
  const files = new Set<string>();
  const forwardEdgesRaw = new Map<string, Set<string>>();
  const reverseEdgesRaw = new Map<string, Set<string>>();

  for (const [from, to] of edges) {
    files.add(from);
    files.add(to);

    if (!forwardEdgesRaw.has(from)) forwardEdgesRaw.set(from, new Set());
    if (!forwardEdgesRaw.has(to)) forwardEdgesRaw.set(to, new Set());
    if (!reverseEdgesRaw.has(from)) reverseEdgesRaw.set(from, new Set());
    if (!reverseEdgesRaw.has(to)) reverseEdgesRaw.set(to, new Set());

    forwardEdgesRaw.get(from)!.add(to);
    reverseEdgesRaw.get(to)!.add(from);
  }

  return {
    files,
    forwardEdges: forwardEdgesRaw,
    reverseEdges: reverseEdgesRaw,
    definitions: new Map(),
  };
}

// Add isolated nodes (no edges) to a graph built from edges.
function addNodes(graph: FileGraph, nodes: string[]): FileGraph {
  const files = new Set(graph.files);
  const forwardEdges = new Map(graph.forwardEdges as Map<string, Set<string>>);
  const reverseEdges = new Map(graph.reverseEdges as Map<string, Set<string>>);
  for (const node of nodes) {
    files.add(node);
    if (!forwardEdges.has(node)) forwardEdges.set(node, new Set());
    if (!reverseEdges.has(node)) reverseEdges.set(node, new Set());
  }
  return { files, forwardEdges, reverseEdges, definitions: new Map() };
}

const DEFAULT_OPTS: PageRankOptions = {
  alpha: 0.85,
  maxIterations: 100,
  tolerance: 1e-6,
};

// Verify a result has consistent scores: sum ~1.0, no monopolization.
function assertConverged(
  scores: ReadonlyMap<string, number>,
  nodeCount: number,
): void {
  const values = Array.from(scores.values());
  const sum = values.reduce((acc, v) => acc + v, 0);
  expect(sum).toBeCloseTo(1.0, 1); // within 0.1

  if (nodeCount > 2) {
    const max = Math.max(...values);
    expect(max).toBeLessThan(0.9);
  }
}

describe('computePageRank — standard PageRank', () => {
  it('empty graph returns empty scores, 0 iterations, converged=true', () => {
    const graph: FileGraph = {
      files: new Set(),
      forwardEdges: new Map(),
      reverseEdges: new Map(),
      definitions: new Map(),
    };
    const result = computePageRank(graph, DEFAULT_OPTS);
    expect(result.scores.size).toBe(0);
    expect(result.iterations).toBe(0);
    expect(result.converged).toBe(true);
  });

  it('single file with no edges returns score 1.0', () => {
    const graph: FileGraph = {
      files: new Set(['a.ts']),
      forwardEdges: new Map([['a.ts', new Set()]]),
      reverseEdges: new Map([['a.ts', new Set()]]),
      definitions: new Map(),
    };
    const result = computePageRank(graph, DEFAULT_OPTS);
    expect(result.scores.get('a.ts')).toBeCloseTo(1.0, 4);
    expect(result.converged).toBe(true);
  });

  it('linear chain A->B->C: C scores highest (most imported), A scores lowest', () => {
    // A imports B, B imports C: C is the "utility" end
    const graph = makeGraph([
      ['a.ts', 'b.ts'],
      ['b.ts', 'c.ts'],
    ]);
    const result = computePageRank(graph, DEFAULT_OPTS);
    const scoreA = result.scores.get('a.ts')!;
    const scoreB = result.scores.get('b.ts')!;
    const scoreC = result.scores.get('c.ts')!;

    expect(scoreC).toBeGreaterThan(scoreB);
    expect(scoreB).toBeGreaterThan(scoreA);
    expect(result.converged).toBe(true);
  });

  it('star pattern (A->X, B->X, C->X, D->X): X scores highest — hub detection', () => {
    const graph = makeGraph([
      ['a.ts', 'x.ts'],
      ['b.ts', 'x.ts'],
      ['c.ts', 'x.ts'],
      ['d.ts', 'x.ts'],
    ]);
    const result = computePageRank(graph, DEFAULT_OPTS);
    const scores = result.scores;
    const scoreX = scores.get('x.ts')!;

    for (const node of ['a.ts', 'b.ts', 'c.ts', 'd.ts']) {
      expect(scoreX).toBeGreaterThan(scores.get(node)!);
    }
    expect(result.converged).toBe(true);
  });

  it('all scores sum to approximately 1.0', () => {
    const graph = makeGraph([
      ['a.ts', 'b.ts'],
      ['b.ts', 'c.ts'],
      ['c.ts', 'd.ts'],
      ['a.ts', 'd.ts'],
    ]);
    const result = computePageRank(graph, DEFAULT_OPTS);
    assertConverged(result.scores, graph.files.size);
  });

  it('no single file monopolizes rank for graphs with more than 2 nodes', () => {
    const graph = makeGraph([
      ['a.ts', 'b.ts'],
      ['b.ts', 'c.ts'],
      ['c.ts', 'a.ts'],
    ]);
    const result = computePageRank(graph, DEFAULT_OPTS);
    const values = Array.from(result.scores.values());
    const max = Math.max(...values);
    expect(max).toBeLessThan(0.9);
  });

  it('dangling node (inbound edges, no outbound) does NOT monopolize rank (~1.0)', () => {
    // c.ts has inbound from a.ts and b.ts, but no outbound edges — it is a "dangling" node
    const graph = makeGraph([
      ['a.ts', 'c.ts'],
      ['b.ts', 'c.ts'],
    ]);
    const result = computePageRank(graph, DEFAULT_OPTS);
    const scoreC = result.scores.get('c.ts')!;
    // c.ts should rank highest but must not absorb all rank
    expect(scoreC).toBeLessThan(0.9);
    expect(result.converged).toBe(true);
  });

  it('converges within 100 iterations for small graphs', () => {
    const graph = makeGraph([
      ['a.ts', 'b.ts'],
      ['b.ts', 'c.ts'],
      ['c.ts', 'd.ts'],
      ['d.ts', 'a.ts'],
    ]);
    const result = computePageRank(graph, DEFAULT_OPTS);
    expect(result.iterations).toBeLessThanOrEqual(100);
    expect(result.converged).toBe(true);
  });

  it('two disconnected subgraphs each have internally consistent rankings', () => {
    // Subgraph 1: a.ts -> b.ts (b ranks higher)
    // Subgraph 2: c.ts -> d.ts -> e.ts (e ranks highest in subgraph)
    const graph = makeGraph([
      ['a.ts', 'b.ts'],
      ['c.ts', 'd.ts'],
      ['d.ts', 'e.ts'],
    ]);
    const result = computePageRank(graph, DEFAULT_OPTS);

    const scoreB = result.scores.get('b.ts')!;
    const scoreA = result.scores.get('a.ts')!;
    const scoreE = result.scores.get('e.ts')!;
    const scoreD = result.scores.get('d.ts')!;
    const scoreC = result.scores.get('c.ts')!;

    // Within subgraph 1: b > a
    expect(scoreB).toBeGreaterThan(scoreA);
    // Within subgraph 2: e > d > c
    expect(scoreE).toBeGreaterThan(scoreD);
    expect(scoreD).toBeGreaterThan(scoreC);

    assertConverged(result.scores, graph.files.size);
  });
});
