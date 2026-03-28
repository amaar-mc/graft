// Tests for renderTree — tree-style rendering of the file graph sorted by PageRank score.
// Constructs FileGraph and scores manually (no real parsing).

import { describe, it, expect } from 'vitest';
import { renderTree } from '../../src/renderer/tree.js';
import type { FileGraph, TreeRendererOptions } from '../../src/graph/types.js';
import type { CodeNode } from '../../src/parser/types.js';

const ROOT = '/project';

const DEFAULT_OPTS: TreeRendererOptions = {
  tokenBudget: 2048,
  charsPerToken: 3,
};

function makeNode(
  filePath: string,
  name: string,
  kind: CodeNode['kind'],
  startLine: number,
  endLine: number,
): CodeNode {
  return {
    id: `${filePath}:${name}:${startLine}`,
    name,
    kind,
    filePath,
    startLine,
    endLine,
    references: [],
  };
}

// Build a minimal FileGraph with given files, edges, and definitions.
function makeGraph(
  filePaths: string[],
  defs: Map<string, CodeNode[]>,
): FileGraph {
  const files = new Set(filePaths);
  const forwardEdges = new Map<string, Set<string>>(
    filePaths.map((f) => [f, new Set()]),
  );
  const reverseEdges = new Map<string, Set<string>>(
    filePaths.map((f) => [f, new Set()]),
  );
  return { files, forwardEdges, reverseEdges, definitions: defs };
}

const fileA = `${ROOT}/src/a.ts`;
const fileB = `${ROOT}/src/b.ts`;
const fileC = `${ROOT}/src/c.ts`;

const scores: ReadonlyMap<string, number> = new Map([
  [fileA, 0.5],
  [fileB, 0.3],
  [fileC, 0.1],
]);

const defs = new Map<string, CodeNode[]>([
  [
    fileA,
    [
      makeNode(fileA, 'doWork', 'function', 5, 20),
      makeNode(fileA, 'MyClass', 'class', 25, 50),
      makeNode(fileA, 'importPath', 'import', 1, 3), // should be excluded
    ],
  ],
  [fileB, [makeNode(fileB, 'helper', 'function', 2, 10)]],
  [fileC, []],
]);

const graph = makeGraph([fileA, fileB, fileC], defs);

describe('renderTree — output ordering and structure', () => {
  it('files appear sorted by score descending (highest first)', () => {
    const output = renderTree(graph, scores, ROOT, DEFAULT_OPTS);
    const posA = output.indexOf('src/a.ts');
    const posB = output.indexOf('src/b.ts');
    const posC = output.indexOf('src/c.ts');
    expect(posA).toBeGreaterThanOrEqual(0);
    expect(posB).toBeGreaterThanOrEqual(0);
    expect(posC).toBeGreaterThanOrEqual(0);
    expect(posA).toBeLessThan(posB);
    expect(posB).toBeLessThan(posC);
  });

  it('each file shows its relative path', () => {
    const output = renderTree(graph, scores, ROOT, DEFAULT_OPTS);
    expect(output).toContain('src/a.ts');
    expect(output).toContain('src/b.ts');
    expect(output).toContain('src/c.ts');
  });

  it('each file shows its score', () => {
    const output = renderTree(graph, scores, ROOT, DEFAULT_OPTS);
    expect(output).toContain('0.5000');
    expect(output).toContain('0.3000');
    expect(output).toContain('0.1000');
  });

  it('definitions appear indented under their file', () => {
    const output = renderTree(graph, scores, ROOT, DEFAULT_OPTS);
    const posA = output.indexOf('src/a.ts');
    const posDoWork = output.indexOf('doWork');
    const posB = output.indexOf('src/b.ts');
    // doWork appears after a.ts header and before b.ts header
    expect(posDoWork).toBeGreaterThan(posA);
    expect(posDoWork).toBeLessThan(posB);
  });

  it('import kind definitions are excluded from output', () => {
    const output = renderTree(graph, scores, ROOT, DEFAULT_OPTS);
    expect(output).not.toContain('importPath');
  });

  it('export kind definitions are excluded from output', () => {
    const exportNode = makeNode(fileA, 'myExport', 'export', 2, 4);
    const defsWithExport = new Map(defs);
    defsWithExport.set(fileA, [...(defs.get(fileA) ?? []), exportNode]);
    const graphWithExport = makeGraph([fileA, fileB, fileC], defsWithExport);
    const output = renderTree(graphWithExport, scores, ROOT, DEFAULT_OPTS);
    expect(output).not.toContain('myExport');
  });

  it('output ends with token count footer in format [~N tokens]', () => {
    const output = renderTree(graph, scores, ROOT, DEFAULT_OPTS);
    expect(output).toMatch(/\[~\d+ tokens\]$/);
  });

  it('empty graph produces only the token footer', () => {
    const emptyGraph = makeGraph([], new Map());
    const emptyScores: ReadonlyMap<string, number> = new Map();
    const output = renderTree(emptyGraph, emptyScores, ROOT, DEFAULT_OPTS);
    expect(output).toMatch(/^\[~0 tokens\]$/);
  });
});
