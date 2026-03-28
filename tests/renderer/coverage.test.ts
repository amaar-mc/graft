// Targeted coverage tests for uncovered branches in src/renderer/tree.ts and src/renderer/json.ts.
// Covers:
//   - lines 26-42 in tree.ts: ?? 0 nullish branch when a file has no score entry
//   - lines 48-56 in json.ts: ?? 0 nullish branch when a file has no score entry
// V8 counts each ?? operator as 2 branches. Tests must include files absent from the scores map.

import { describe, it, expect } from 'vitest';
import { renderTree } from '../../src/renderer/tree.js';
import { renderJson } from '../../src/renderer/json.js';
import type { FileGraph, TreeRendererOptions, JsonRendererOptions } from '../../src/graph/types.js';

const ROOT = '/project';

const DEFAULT_TREE_OPTS: TreeRendererOptions = { tokenBudget: 2048, charsPerToken: 3 };
const DEFAULT_JSON_OPTS: JsonRendererOptions = {};

function makeGraph(filePaths: string[]): FileGraph {
  const files = new Set(filePaths);
  const forwardEdges = new Map<string, Set<string>>(filePaths.map((f) => [f, new Set()]));
  const reverseEdges = new Map<string, Set<string>>(filePaths.map((f) => [f, new Set()]));
  return { files, forwardEdges, reverseEdges, definitions: new Map() };
}

describe('renderTree coverage gaps', () => {
  it('handles files not present in scores map (uses 0 as fallback via ?? operator)', () => {
    const fileA = `${ROOT}/src/a.ts`;
    const fileB = `${ROOT}/src/b.ts`;
    const graph = makeGraph([fileA, fileB]);

    // scores map only contains fileA — fileB.get() returns undefined, ?? 0 branch triggers
    const scores: ReadonlyMap<string, number> = new Map([[fileA, 0.5]]);

    const output = renderTree(graph, scores, ROOT, DEFAULT_TREE_OPTS);
    expect(output).toContain('src/a.ts');
    expect(output).toContain('src/b.ts');
    // fileA has a score; fileB defaults to 0.0000
    expect(output).toContain('[score: 0.5000]');
    expect(output).toContain('[score: 0.0000]');
  });

  it('handles files with equal scores (sort comparator returns 0)', () => {
    const fileA = `${ROOT}/src/a.ts`;
    const fileB = `${ROOT}/src/b.ts`;
    const graph = makeGraph([fileA, fileB]);

    // Both files have identical scores — comparator returns 0
    const scores: ReadonlyMap<string, number> = new Map([
      [fileA, 0.5],
      [fileB, 0.5],
    ]);

    const output = renderTree(graph, scores, ROOT, DEFAULT_TREE_OPTS);
    expect(output).toContain('src/a.ts');
    expect(output).toContain('src/b.ts');
  });
});

describe('renderJson coverage gaps', () => {
  it('handles files not present in scores map (uses 0 as fallback via ?? operator)', () => {
    const fileA = `${ROOT}/src/a.ts`;
    const fileB = `${ROOT}/src/b.ts`;
    const graph = makeGraph([fileA, fileB]);

    // scores map only contains fileA — fileB.get() returns undefined, ?? 0 branch triggers
    const scores: ReadonlyMap<string, number> = new Map([[fileA, 0.7]]);

    const output = renderJson(graph, scores, ROOT, DEFAULT_JSON_OPTS);
    const parsed = JSON.parse(output) as { files: { filePath: string; score: number }[] };
    const bEntry = parsed.files.find((f) => f.filePath.includes('b.ts'));
    expect(bEntry).toBeDefined();
    expect(bEntry!.score).toBe(0);
  });

  it('handles files with equal scores in sort comparator', () => {
    const fileA = `${ROOT}/src/a.ts`;
    const fileB = `${ROOT}/src/b.ts`;
    const graph = makeGraph([fileA, fileB]);

    const scores: ReadonlyMap<string, number> = new Map([
      [fileA, 0.4],
      [fileB, 0.4],
    ]);

    const output = renderJson(graph, scores, ROOT, DEFAULT_JSON_OPTS);
    const parsed = JSON.parse(output) as { files: unknown[] };
    expect(parsed.files).toHaveLength(2);
  });

  it('handles empty graph (no files, no edges)', () => {
    const graph = makeGraph([]);
    const scores: ReadonlyMap<string, number> = new Map();
    const output = renderJson(graph, scores, ROOT, DEFAULT_JSON_OPTS);
    const parsed = JSON.parse(output) as {
      metadata: { fileCount: number; edgeCount: number };
      files: unknown[];
    };
    expect(parsed.metadata.fileCount).toBe(0);
    expect(parsed.metadata.edgeCount).toBe(0);
    expect(parsed.files).toHaveLength(0);
  });
});
