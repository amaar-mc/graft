// Tests for renderJson — JSON map renderer with scores and metadata.

import { describe, it, expect } from 'vitest';
import { renderJson } from '../../src/renderer/json.js';
import type { FileGraph, JsonRendererOptions } from '../../src/graph/types.js';
import type { CodeNode } from '../../src/parser/types.js';

const ROOT = '/project';
const OPTS: JsonRendererOptions = {};

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

function makeGraph(
  edges: [string, string][],
  defs: Map<string, CodeNode[]>,
): FileGraph {
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

  // Ensure all files with defs are in the graph
  for (const fp of defs.keys()) {
    files.add(fp);
    if (!forwardEdgesRaw.has(fp)) forwardEdgesRaw.set(fp, new Set());
    if (!reverseEdgesRaw.has(fp)) reverseEdgesRaw.set(fp, new Set());
  }

  return {
    files,
    forwardEdges: forwardEdgesRaw,
    reverseEdges: reverseEdgesRaw,
    definitions: defs,
  };
}

const fileA = `${ROOT}/src/a.ts`;
const fileB = `${ROOT}/src/b.ts`;

const defs = new Map<string, CodeNode[]>([
  [
    fileA,
    [
      makeNode(fileA, 'doWork', 'function', 5, 20),
      makeNode(fileA, 'myImport', 'import', 1, 3), // should be excluded
    ],
  ],
  [
    fileB,
    [
      makeNode(fileB, 'helper', 'function', 2, 10),
      makeNode(fileB, 'reExport', 'export', 1, 2), // should be excluded
    ],
  ],
]);

const graph = makeGraph([[fileA, fileB]], defs);

const scores: ReadonlyMap<string, number> = new Map([
  [fileA, 0.6],
  [fileB, 0.4],
]);

describe('renderJson — structure and validity', () => {
  it('output is valid JSON (JSON.parse succeeds)', () => {
    const output = renderJson(graph, scores, ROOT, OPTS);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('JSON contains files array with filePath, score, definitions', () => {
    const output = renderJson(graph, scores, ROOT, OPTS);
    const parsed = JSON.parse(output) as {
      files: { filePath: string; score: number; definitions: unknown[] }[];
    };
    expect(Array.isArray(parsed.files)).toBe(true);
    const fileAEntry = parsed.files.find((f) => f.filePath.includes('a.ts'));
    expect(fileAEntry).toBeDefined();
    expect(typeof fileAEntry?.score).toBe('number');
    expect(Array.isArray(fileAEntry?.definitions)).toBe(true);
  });

  it('JSON contains metadata object with fileCount, edgeCount, tokenCount', () => {
    const output = renderJson(graph, scores, ROOT, OPTS);
    const parsed = JSON.parse(output) as {
      metadata: {
        fileCount: number;
        edgeCount: number;
        tokenCount: number;
        rootDir: string;
      };
    };
    expect(typeof parsed.metadata).toBe('object');
    expect(typeof parsed.metadata.fileCount).toBe('number');
    expect(typeof parsed.metadata.edgeCount).toBe('number');
    expect(typeof parsed.metadata.tokenCount).toBe('number');
    expect(parsed.metadata.rootDir).toBe(ROOT);
  });

  it('JSON files array is sorted by score descending', () => {
    const output = renderJson(graph, scores, ROOT, OPTS);
    const parsed = JSON.parse(output) as { files: { score: number }[] };
    const fileScores = parsed.files.map((f) => f.score);
    for (let i = 1; i < fileScores.length; i++) {
      expect(fileScores[i - 1]).toBeGreaterThanOrEqual(fileScores[i]!);
    }
  });

  it('JSON definitions exclude import kinds', () => {
    const output = renderJson(graph, scores, ROOT, OPTS);
    const parsed = JSON.parse(output) as {
      files: { filePath: string; definitions: { name: string }[] }[];
    };
    const fileAEntry = parsed.files.find((f) => f.filePath.includes('a.ts'))!;
    const defNames = fileAEntry.definitions.map((d) => d.name);
    expect(defNames).not.toContain('myImport');
    expect(defNames).toContain('doWork');
  });

  it('JSON definitions exclude export kinds', () => {
    const output = renderJson(graph, scores, ROOT, OPTS);
    const parsed = JSON.parse(output) as {
      files: { filePath: string; definitions: { name: string }[] }[];
    };
    const fileBEntry = parsed.files.find((f) => f.filePath.includes('b.ts'))!;
    const defNames = fileBEntry.definitions.map((d) => d.name);
    expect(defNames).not.toContain('reExport');
    expect(defNames).toContain('helper');
  });

  it('metadata.edgeCount equals sum of all forwardEdge set sizes', () => {
    const output = renderJson(graph, scores, ROOT, OPTS);
    const parsed = JSON.parse(output) as {
      metadata: { edgeCount: number };
    };
    // graph has one edge: fileA -> fileB
    expect(parsed.metadata.edgeCount).toBe(1);
  });

  it('metadata.fileCount equals number of files in graph', () => {
    const output = renderJson(graph, scores, ROOT, OPTS);
    const parsed = JSON.parse(output) as { metadata: { fileCount: number } };
    expect(parsed.metadata.fileCount).toBe(2);
  });

  it('filePaths in JSON are relative to rootDir', () => {
    const output = renderJson(graph, scores, ROOT, OPTS);
    const parsed = JSON.parse(output) as {
      files: { filePath: string }[];
    };
    for (const f of parsed.files) {
      expect(f.filePath).not.toContain('/project/');
      expect(f.filePath.startsWith('src/')).toBe(true);
    }
  });
});
