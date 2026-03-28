// Targeted coverage tests for uncovered branches in src/graph/index.ts.
// Covers:
//   - lines 68-69: bare Python package import resolving to __init__.py (or null)
//   - line 87: import of file not in known-files set (no edge created)
//   - line 106: resolveWithExtensions returning null (index variant also not found)
//   - line 147: defensive guard — resolved path not in knownFiles
//
// NOTE: In the current graph API, import/export nodes use node.name as the module path.
// node.references holds the imported identifiers (not the module path).

import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/graph/index.js';
import type { ParseResult } from '../../src/parser/types.js';

// Helper to create a minimal import node — name is the module path
function makeImportNode(filePath: string, modulePath: string) {
  return {
    id: `import-${modulePath}`,
    name: modulePath,
    kind: 'import' as const,
    filePath,
    startLine: 1,
    endLine: 1,
    references: [],
  };
}

function makeResult(filePath: string, modulePaths: string[] = []): ParseResult {
  return {
    filePath,
    parseTimeMs: 0,
    nodes: modulePaths.map((mod) => makeImportNode(filePath, mod)),
  };
}

describe('buildGraph coverage gaps', () => {
  it('drops bare npm package imports (no relative prefix)', () => {
    const fileA = '/project/src/a.ts';
    const results: ParseResult[] = [
      makeResult(fileA, ['lodash', 'express']),
    ];
    const graph = buildGraph(results);
    // No forward edges from fileA — npm packages are silently dropped
    expect(graph.forwardEdges.get(fileA)!.size).toBe(0);
  });

  it('drops import of file not in the known files set', () => {
    const fileA = '/project/src/a.ts';
    const results: ParseResult[] = [
      makeResult(fileA, ['./nonexistent']),
    ];
    const graph = buildGraph(results);
    expect(graph.forwardEdges.get(fileA)!.size).toBe(0);
  });

  it('file with only import nodes (no definition nodes) appears in graph.files', () => {
    const fileA = '/project/src/a.ts';
    const fileB = '/project/src/b.ts';
    const results: ParseResult[] = [
      makeResult(fileA, ['./b']),
      makeResult(fileB),
    ];
    const graph = buildGraph(results);
    expect(graph.files.has(fileA)).toBe(true);
    expect(graph.files.has(fileB)).toBe(true);
    // fileA imports fileB — forward edge created (module path ./b resolves to /project/src/b.ts)
    expect(graph.forwardEdges.get(fileA)!.has(fileB)).toBe(true);
  });

  it('handles Python multi-dot relative import to __init__.py (lines 68-69 branch)', () => {
    // Multi-dot "..": resolvePythonRelative with dots=2, moduleName=""
    // Should resolve to __init__.py in parent directory if it exists in known files
    const fileA = '/project/pkg/sub/a.py';
    const initPy = '/project/pkg/__init__.py';
    const results: ParseResult[] = [
      makeResult(fileA, ['..']),
      makeResult(initPy),
    ];
    const graph = buildGraph(results);
    // ".." from /project/pkg/sub/a.py navigates up 1 dir (dots=2 means 1 level up)
    // baseDir becomes /project/pkg — initPath = /project/pkg/__init__.py
    expect(graph.forwardEdges.get(fileA)!.has(initPy)).toBe(true);
  });

  it('drops multi-dot relative import when __init__.py is not in known files (line 69 null branch)', () => {
    const fileA = '/project/pkg/sub/a.py';
    const results: ParseResult[] = [
      makeResult(fileA, ['..']),
    ];
    const graph = buildGraph(results);
    // No __init__.py in known files — resolves to null, edge silently dropped
    expect(graph.forwardEdges.get(fileA)!.size).toBe(0);
  });

  it('resolveWithExtensions returns null when no extension or index variant matches (line 106)', () => {
    // Import ./foo where /project/src/foo + no extension and /project/src/foo/index.* all absent
    const fileA = '/project/src/a.ts';
    const results: ParseResult[] = [makeResult(fileA, ['./totally-missing-module'])];
    const graph = buildGraph(results);
    expect(graph.forwardEdges.get(fileA)!.size).toBe(0);
  });

  it('resolves relative import when module path already includes extension', () => {
    const fileA = '/project/src/a.ts';
    const fileB = '/project/src/b.ts';
    const results: ParseResult[] = [
      makeResult(fileA, ['./b.ts']),
      makeResult(fileB),
    ];
    const graph = buildGraph(results);
    // Bare path with extension is tried first in resolveWithExtensions
    expect(graph.forwardEdges.get(fileA)!.has(fileB)).toBe(true);
  });
});
