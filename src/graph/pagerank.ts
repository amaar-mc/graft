// PageRank engine for the file dependency graph.
// Uses power iteration (Pattern 3 from research) with dangling node redistribution.
// Supports both standard and personalized modes via the teleport vector.

import type { FileGraph, PageRankOptions, PageRankResult } from './types.js';

// Build the teleport probability vector.
// In standard mode: uniform 1/N for all nodes.
// In personalized mode: normalize caller-supplied weights to sum 1.0.
// Falls back to uniform if all seed weights are zero or no seed nodes are in the graph.
function buildTeleportVector(
  nodes: readonly string[],
  personalization: ReadonlyMap<string, number> | undefined,
): Map<string, number> {
  const N = nodes.length;
  const uniform = 1 / N;
  const teleport = new Map<string, number>();

  if (personalization === undefined || personalization.size === 0) {
    for (const node of nodes) {
      teleport.set(node, uniform);
    }
    return teleport;
  }

  // Sum only weights for nodes that actually exist in the graph.
  let totalWeight = 0;
  for (const node of nodes) {
    const w = personalization.get(node) ?? 0;
    totalWeight += w;
  }

  if (totalWeight === 0) {
    // All seed nodes are outside the graph or all weights are zero — fall back to uniform.
    for (const node of nodes) {
      teleport.set(node, uniform);
    }
    return teleport;
  }

  for (const node of nodes) {
    const w = personalization.get(node) ?? 0;
    teleport.set(node, w / totalWeight);
  }
  return teleport;
}

// Compute PageRank scores for all files in the graph using power iteration.
// Files with many importers (high in-degree) score higher than leaf files.
// Dangling nodes (no outgoing edges) redistribute rank uniformly via the teleport vector
// rather than concentrating it, preventing rank sinks.
function computePageRank(graph: FileGraph, options: PageRankOptions): PageRankResult {
  const nodes = Array.from(graph.files);
  const N = nodes.length;

  if (N === 0) {
    return {
      scores: new Map(),
      iterations: 0,
      converged: true,
    };
  }

  const { alpha, maxIterations, tolerance } = options;
  const teleport = buildTeleportVector(nodes, options.personalization);

  // Precompute out-degree for each node. Nodes with out-degree 0 are "dangling".
  const outDegree = new Map<string, number>();
  for (const node of nodes) {
    outDegree.set(node, graph.forwardEdges.get(node)?.size ?? 0);
  }

  // Initialize all scores to 1/N.
  let scores = new Map<string, number>();
  for (const node of nodes) {
    scores.set(node, 1 / N);
  }

  let iterations = 0;
  let converged = false;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;

    // Dangling sum: total rank held by nodes with no outbound edges.
    // This rank must be redistributed to all nodes proportional to the teleport vector
    // (not lost), to keep scores summing to 1.0.
    let danglingSum = 0;
    for (const node of nodes) {
      if ((outDegree.get(node) ?? 0) === 0) {
        danglingSum += scores.get(node)!;
      }
    }

    const newScores = new Map<string, number>();
    for (const node of nodes) {
      const tv = teleport.get(node)!;

      // Link contribution: sum of rank passed along inbound edges.
      let linkRank = 0;
      const inboundEdges = graph.reverseEdges.get(node);
      if (inboundEdges !== undefined) {
        for (const source of inboundEdges) {
          const sourceDegree = outDegree.get(source) ?? 0;
          if (sourceDegree > 0) {
            linkRank += scores.get(source)! / sourceDegree;
          }
        }
      }

      // Power iteration formula with dangling redistribution:
      // score(v) = alpha * (linkRank(v) + danglingSum * teleport(v)) + (1 - alpha) * teleport(v)
      newScores.set(node, alpha * (linkRank + danglingSum * tv) + (1 - alpha) * tv);
    }

    // Compute L1 delta between new and old scores to check convergence.
    let delta = 0;
    for (const node of nodes) {
      delta += Math.abs(newScores.get(node)! - scores.get(node)!);
    }

    scores = newScores;

    if (delta < tolerance) {
      converged = true;
      break;
    }
  }

  return { scores, iterations, converged };
}

export { computePageRank };
