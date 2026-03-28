// Type contracts for the graph layer.
// FileGraph is the core data structure: nodes are files, edges are import dependencies.
// PageRank types define the scoring interface used by the renderer.

import type { CodeNode } from '../parser/types.js';

interface FileGraph {
  readonly files: ReadonlySet<string>;
  // Forward edges: file -> set of files it imports
  readonly forwardEdges: ReadonlyMap<string, ReadonlySet<string>>;
  // Reverse edges: file -> set of files that import it (for efficient in-degree access)
  readonly reverseEdges: ReadonlyMap<string, ReadonlySet<string>>;
  readonly definitions: ReadonlyMap<string, readonly CodeNode[]>;
}

interface PageRankOptions {
  // Damping factor: probability of following a link vs teleporting. Default 0.85.
  readonly alpha: number;
  // Maximum power iterations before stopping. Default 100.
  readonly maxIterations: number;
  // Convergence delta threshold (L1 norm). Default 1e-6.
  readonly tolerance: number;
  // Optional per-file weights for personalized PageRank.
  // Unnormalized — weights are normalized internally before use.
  readonly personalization?: ReadonlyMap<string, number>;
}

interface PageRankResult {
  readonly scores: ReadonlyMap<string, number>;
  readonly iterations: number;
  readonly converged: boolean;
}

export type { FileGraph, PageRankOptions, PageRankResult };
