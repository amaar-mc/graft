// Forward and reverse dependency query functions over a FileGraph.
// These are thin wrappers that form the public API contract for Phase 3 CLI/MCP consumers.
// Both functions return empty sets for unknown files rather than throwing.

import type { FileGraph, TraversalResult } from './types.js';

// Return the set of files directly imported by filePath.
// Returns empty TraversalResult if filePath is not in the graph.
function forwardDeps(graph: FileGraph, filePath: string): TraversalResult {
  const edges = graph.forwardEdges.get(filePath);
  if (edges === undefined) {
    return { files: new Set<string>() };
  }
  return { files: edges };
}

// Return the set of files that directly import filePath.
// Returns empty TraversalResult if filePath is not in the graph.
function reverseDeps(graph: FileGraph, filePath: string): TraversalResult {
  const edges = graph.reverseEdges.get(filePath);
  if (edges === undefined) {
    return { files: new Set<string>() };
  }
  return { files: edges };
}

export { forwardDeps, reverseDeps };
