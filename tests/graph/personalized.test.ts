import { describe, it, expect } from 'vitest';
import { computePageRank } from '../../src/graph/pagerank.js';
import type { FileGraph, PageRankOptions } from '../../src/graph/types.js';

// Duplicated from pagerank.test.ts — keeping it inline avoids a shared helper dep for 10 lines.
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

// Graph structure used across personalized tests:
// a.ts -> b.ts -> c.ts -> d.ts
//                 ^
//                 |
//              e.ts
// c.ts and d.ts are the well-connected "library" files.
function makeTestGraph(): FileGraph {
  return makeGraph([
    ['a.ts', 'b.ts'],
    ['b.ts', 'c.ts'],
    ['c.ts', 'd.ts'],
    ['e.ts', 'c.ts'],
  ]);
}

const BASE_OPTS: Omit<PageRankOptions, 'personalization'> = {
  alpha: 0.85,
  maxIterations: 100,
  tolerance: 1e-6,
};

describe('computePageRank — personalized PageRank', () => {
  it('personalization boosting file X makes files near X score higher than standard', () => {
    const graph = makeTestGraph();

    const standard = computePageRank(graph, { ...BASE_OPTS });
    const personalized = computePageRank(graph, {
      ...BASE_OPTS,
      personalization: new Map([['a.ts', 10.0]]), // heavily boost the entry point
    });

    // a.ts neighbors (b.ts) should receive more rank under a.ts-personalized mode
    const standardB = standard.scores.get('b.ts')!;
    const personalizedB = personalized.scores.get('b.ts')!;
    expect(personalizedB).toBeGreaterThan(standardB);
  });

  it('personalization weights are normalized internally (unnormalized input ok)', () => {
    const graph = makeTestGraph();

    // 100 vs 1 — ratio should match 10 vs 0.1 (proportional normalization)
    const resultLarge = computePageRank(graph, {
      ...BASE_OPTS,
      personalization: new Map([
        ['a.ts', 100],
        ['e.ts', 1],
      ]),
    });
    const resultSmall = computePageRank(graph, {
      ...BASE_OPTS,
      personalization: new Map([
        ['a.ts', 10],
        ['e.ts', 0.1],
      ]),
    });

    // Scores must be identical because the ratio is the same after normalization.
    for (const node of graph.files) {
      expect(resultLarge.scores.get(node)!).toBeCloseTo(
        resultSmall.scores.get(node)!,
        6,
      );
    }
  });

  it('personalization vector referencing unknown files falls back to uniform', () => {
    const graph = makeTestGraph();

    const withUnknown = computePageRank(graph, {
      ...BASE_OPTS,
      personalization: new Map([
        ['nonexistent.ts', 5.0], // not in graph
        ['also-missing.ts', 3.0],
      ]),
    });
    const uniform = computePageRank(graph, { ...BASE_OPTS });

    // All scores should be identical — unknown seeds produce uniform teleport.
    for (const node of graph.files) {
      expect(withUnknown.scores.get(node)!).toBeCloseTo(
        uniform.scores.get(node)!,
        6,
      );
    }
  });

  it('personalization with all-zero weights falls back to uniform', () => {
    const graph = makeTestGraph();

    const withZeros = computePageRank(graph, {
      ...BASE_OPTS,
      personalization: new Map([
        ['a.ts', 0],
        ['b.ts', 0],
      ]),
    });
    const uniform = computePageRank(graph, { ...BASE_OPTS });

    for (const node of graph.files) {
      expect(withZeros.scores.get(node)!).toBeCloseTo(
        uniform.scores.get(node)!,
        6,
      );
    }
  });

  it('personalized scores still sum to approximately 1.0', () => {
    const graph = makeTestGraph();

    const result = computePageRank(graph, {
      ...BASE_OPTS,
      personalization: new Map([['d.ts', 1.0]]),
    });

    const sum = Array.from(result.scores.values()).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 4);
  });

  it('two runs with different personalization vectors produce different score orderings', () => {
    const graph = makeTestGraph();

    // Boost the entry-point side (a.ts)
    const resultA = computePageRank(graph, {
      ...BASE_OPTS,
      personalization: new Map([['a.ts', 1.0]]),
    });

    // Boost the library side (d.ts)
    const resultD = computePageRank(graph, {
      ...BASE_OPTS,
      personalization: new Map([['d.ts', 1.0]]),
    });

    // Under a.ts-personalization: a.ts and b.ts get more rank relative to d-personalization
    const rankA_inA = resultA.scores.get('a.ts')!;
    const rankA_inD = resultD.scores.get('a.ts')!;

    const rankD_inD = resultD.scores.get('d.ts')!;
    const rankD_inA = resultA.scores.get('d.ts')!;

    // a.ts should score higher in a-personalized vs d-personalized
    expect(rankA_inA).toBeGreaterThan(rankA_inD);
    // d.ts should score higher in d-personalized vs a-personalized
    expect(rankD_inD).toBeGreaterThan(rankD_inA);
  });
});
