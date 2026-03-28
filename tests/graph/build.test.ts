// Tests for buildGraph: ParseResult[] -> FileGraph conversion
// All file paths use /project/src/ prefix for platform-agnostic testing.
// Synthetic ParseResult objects only — no real file parsing.

import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/graph/index.js';
import type { ParseResult, CodeNode } from '../../src/parser/types.js';

// Helper to create a minimal CodeNode
function makeNode(
  filePath: string,
  name: string,
  kind: CodeNode['kind'],
  references: string[],
  startLine: number = 1,
): CodeNode {
  return {
    id: `${filePath}:${name}:${startLine}`,
    name,
    kind,
    filePath,
    startLine,
    endLine: startLine + 5,
    references,
  };
}

// Helper to create a ParseResult with given nodes
function makeResult(filePath: string, nodes: CodeNode[]): ParseResult {
  return { filePath, nodes, parseTimeMs: 0 };
}

describe('buildGraph', () => {
  describe('empty input', () => {
    it('returns FileGraph with 0 files and empty edges for empty ParseResult[]', () => {
      const graph = buildGraph([]);
      expect(graph.files.size).toBe(0);
      expect(graph.forwardEdges.size).toBe(0);
      expect(graph.reverseEdges.size).toBe(0);
      expect(graph.definitions.size).toBe(0);
    });
  });

  describe('basic edge construction', () => {
    it('builds correct forward and reverse edges for A->B->C chain', () => {
      const fileA = '/project/src/a.ts';
      const fileB = '/project/src/b.ts';
      const fileC = '/project/src/c.ts';

      const results: ParseResult[] = [
        makeResult(fileA, [makeNode(fileA, 'importB', 'import', ['./b'])]),
        makeResult(fileB, [makeNode(fileB, 'importC', 'import', ['./c'])]),
        makeResult(fileC, [makeNode(fileC, 'exportFoo', 'export', [])]),
      ];

      const graph = buildGraph(results);

      // files set
      expect(graph.files.has(fileA)).toBe(true);
      expect(graph.files.has(fileB)).toBe(true);
      expect(graph.files.has(fileC)).toBe(true);

      // forward edges: A->{B}, B->{C}, C->{}
      expect(graph.forwardEdges.get(fileA)?.has(fileB)).toBe(true);
      expect(graph.forwardEdges.get(fileA)?.size).toBe(1);
      expect(graph.forwardEdges.get(fileB)?.has(fileC)).toBe(true);
      expect(graph.forwardEdges.get(fileB)?.size).toBe(1);
      expect(graph.forwardEdges.get(fileC)?.size).toBe(0);

      // reverse edges: A->{}, B->{A}, C->{B}
      expect(graph.reverseEdges.get(fileA)?.size).toBe(0);
      expect(graph.reverseEdges.get(fileB)?.has(fileA)).toBe(true);
      expect(graph.reverseEdges.get(fileB)?.size).toBe(1);
      expect(graph.reverseEdges.get(fileC)?.has(fileB)).toBe(true);
      expect(graph.reverseEdges.get(fileC)?.size).toBe(1);
    });
  });

  describe('import resolution', () => {
    it('silently drops npm package imports with no edges created', () => {
      const fileA = '/project/src/a.ts';
      const results: ParseResult[] = [
        makeResult(fileA, [
          makeNode(fileA, 'importLodash', 'import', ['lodash']),
          makeNode(fileA, 'importReact', 'import', ['react']),
          makeNode(fileA, 'importBuiltin', 'import', ['node:path']),
        ]),
      ];

      const graph = buildGraph(results);
      expect(graph.files.size).toBe(1);
      expect(graph.forwardEdges.get(fileA)?.size).toBe(0);
    });

    it('resolves relative imports to absolute paths matching files set', () => {
      const fileA = '/project/src/a.ts';
      const fileB = '/project/src/utils/b.ts';
      const results: ParseResult[] = [
        makeResult(fileA, [makeNode(fileA, 'importB', 'import', ['./utils/b'])]),
        makeResult(fileB, []),
      ];

      const graph = buildGraph(results);
      expect(graph.forwardEdges.get(fileA)?.has(fileB)).toBe(true);
    });

    it('resolves parent directory relative imports (../)', () => {
      const fileA = '/project/src/utils/a.ts';
      const fileB = '/project/src/b.ts';
      const results: ParseResult[] = [
        makeResult(fileA, [makeNode(fileA, 'importB', 'import', ['../b'])]),
        makeResult(fileB, []),
      ];

      const graph = buildGraph(results);
      expect(graph.forwardEdges.get(fileA)?.has(fileB)).toBe(true);
    });

    it('resolves index file imports (./foo resolves to ./foo/index.ts)', () => {
      const fileA = '/project/src/a.ts';
      const fileIndex = '/project/src/foo/index.ts';
      const results: ParseResult[] = [
        makeResult(fileA, [makeNode(fileA, 'importFoo', 'import', ['./foo'])]),
        makeResult(fileIndex, []),
      ];

      const graph = buildGraph(results);
      expect(graph.forwardEdges.get(fileA)?.has(fileIndex)).toBe(true);
    });

    it('resolves extensionless imports by trying .ts, .tsx, .js extensions', () => {
      const fileA = '/project/src/a.ts';
      const fileB = '/project/src/b.tsx';
      const results: ParseResult[] = [
        makeResult(fileA, [makeNode(fileA, 'importB', 'import', ['./b'])]),
        makeResult(fileB, []),
      ];

      const graph = buildGraph(results);
      expect(graph.forwardEdges.get(fileA)?.has(fileB)).toBe(true);
    });
  });

  describe('Python relative imports', () => {
    it('resolves single-dot Python relative import (.models)', () => {
      const fileA = '/project/src/api/views.py';
      const fileB = '/project/src/api/models.py';
      const results: ParseResult[] = [
        makeResult(fileA, [makeNode(fileA, 'importModels', 'import', ['.models'])]),
        makeResult(fileB, []),
      ];

      const graph = buildGraph(results);
      expect(graph.forwardEdges.get(fileA)?.has(fileB)).toBe(true);
    });

    it('resolves double-dot Python relative import (..core)', () => {
      const fileA = '/project/src/api/views.py';
      const fileB = '/project/src/core.py';
      const results: ParseResult[] = [
        makeResult(fileA, [makeNode(fileA, 'importCore', 'import', ['..core'])]),
        makeResult(fileB, []),
      ];

      const graph = buildGraph(results);
      expect(graph.forwardEdges.get(fileA)?.has(fileB)).toBe(true);
    });
  });

  describe('export nodes (barrel files)', () => {
    it('creates edges for export kind nodes with references', () => {
      const barrel = '/project/src/index.ts';
      const fileA = '/project/src/a.ts';
      const results: ParseResult[] = [
        makeResult(barrel, [makeNode(barrel, 're-exportA', 'export', ['./a'])]),
        makeResult(fileA, []),
      ];

      const graph = buildGraph(results);
      expect(graph.forwardEdges.get(barrel)?.has(fileA)).toBe(true);
    });
  });

  describe('deduplication', () => {
    it('produces single edge for duplicate imports from same file', () => {
      const fileA = '/project/src/a.ts';
      const fileB = '/project/src/b.ts';
      const results: ParseResult[] = [
        makeResult(fileA, [
          makeNode(fileA, 'import1', 'import', ['./b'], 1),
          makeNode(fileA, 'import2', 'import', ['./b'], 5),
        ]),
        makeResult(fileB, []),
      ];

      const graph = buildGraph(results);
      expect(graph.forwardEdges.get(fileA)?.size).toBe(1);
      expect(graph.reverseEdges.get(fileB)?.size).toBe(1);
    });
  });

  describe('definitions-only file', () => {
    it('file with no imports has empty forward edges but appears in files set', () => {
      const fileA = '/project/src/a.ts';
      const results: ParseResult[] = [
        makeResult(fileA, [
          makeNode(fileA, 'MyClass', 'class', []),
          makeNode(fileA, 'myFunc', 'function', []),
        ]),
      ];

      const graph = buildGraph(results);
      expect(graph.files.has(fileA)).toBe(true);
      expect(graph.forwardEdges.get(fileA)?.size).toBe(0);
      expect(graph.definitions.get(fileA)?.length).toBe(2);
    });
  });

  describe('definitions map', () => {
    it('stores all CodeNodes per file in definitions map', () => {
      const fileA = '/project/src/a.ts';
      const nodeA = makeNode(fileA, 'MyClass', 'class', []);
      const nodeB = makeNode(fileA, 'myFunc', 'function', [], 10);
      const results: ParseResult[] = [makeResult(fileA, [nodeA, nodeB])];

      const graph = buildGraph(results);
      const defs = graph.definitions.get(fileA);
      expect(defs?.length).toBe(2);
      expect(defs?.[0]?.name).toBe('MyClass');
      expect(defs?.[1]?.name).toBe('myFunc');
    });
  });
});
