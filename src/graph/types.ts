// Type contracts for Phase 2: graph builder, PageRank, traversal, and renderers.
// All consumers in Phase 2+ depend on these interfaces as the primary seam.

import type { CodeNode } from '../parser/types.js';

// Core directed file dependency graph.
// forwardEdges[A] = set of files A imports.
// reverseEdges[A] = set of files that import A.
interface FileGraph {
  readonly files: ReadonlySet<string>;
  // Forward edges: file -> set of files it imports
  readonly forwardEdges: ReadonlyMap<string, ReadonlySet<string>>;
  // Reverse edges: file -> set of files that import it (for efficient in-degree access)
  readonly reverseEdges: ReadonlyMap<string, ReadonlySet<string>>;
  // All CodeNodes keyed by file path, for downstream consumers (renderer, PageRank).
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

// Options for the tree-style context renderer (Phase 2 plan 03).
interface TreeRendererOptions {
  // Maximum token budget for rendered output.
  readonly tokenBudget: number;
  // Estimated characters per token used to compute budget in characters.
  readonly charsPerToken: number;
}

// Options for the JSON renderer (Phase 2 plan 03) — reserved, empty for now.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface JsonRendererOptions {}

// Result type returned by forward/reverse traversal queries.
interface TraversalResult {
  readonly files: ReadonlySet<string>;
}

export type {
  FileGraph,
  PageRankOptions,
  PageRankResult,
  TreeRendererOptions,
  JsonRendererOptions,
  TraversalResult,
};
