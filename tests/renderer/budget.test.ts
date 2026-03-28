// Tests for renderTree budget enforcement — ensures token budget is respected.

import { describe, it, expect } from 'vitest';
import { renderTree } from '../../src/renderer/tree.js';
import type { FileGraph, TreeRendererOptions } from '../../src/graph/types.js';
import type { CodeNode } from '../../src/parser/types.js';

const ROOT = '/project';

function makeNode(
  filePath: string,
  name: string,
  startLine: number,
): CodeNode {
  return {
    id: `${filePath}:${name}:${startLine}`,
    name,
    kind: 'function',
    filePath,
    startLine,
    endLine: startLine + 10,
    references: [],
  };
}

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

// Generate many files to test budget cutoff
function makeLargeGraph(
  count: number,
): { graph: FileGraph; scores: ReadonlyMap<string, number> } {
  const filePaths: string[] = [];
  const defs = new Map<string, CodeNode[]>();
  const scoreMap = new Map<string, number>();

  for (let i = 0; i < count; i++) {
    const fp = `${ROOT}/src/file${i}.ts`;
    filePaths.push(fp);
    // Many definitions per file to push char count up
    defs.set(fp, [
      makeNode(fp, `funcA${i}`, 10),
      makeNode(fp, `funcB${i}`, 20),
      makeNode(fp, `funcC${i}`, 30),
    ]);
    scoreMap.set(fp, 1 / (i + 1)); // descending scores
  }

  return { graph: makeGraph(filePaths, defs), scores: scoreMap };
}

describe('renderTree — budget enforcement', () => {
  it('output with budget=2048 does not exceed 2048*3=6144 chars (excluding footer)', () => {
    const { graph, scores } = makeLargeGraph(200);
    const opts: TreeRendererOptions = { tokenBudget: 2048, charsPerToken: 3 };
    const output = renderTree(graph, scores, ROOT, opts);
    // Remove footer line for char budget check
    const footerIdx = output.lastIndexOf('\n[~');
    const bodyPart =
      footerIdx >= 0 ? output.substring(0, footerIdx) : output;
    expect(bodyPart.length).toBeLessThanOrEqual(2048 * 3);
  });

  it('files that would push output over budget are excluded entirely (no partial files)', () => {
    const { graph, scores } = makeLargeGraph(200);
    const opts: TreeRendererOptions = { tokenBudget: 2048, charsPerToken: 3 };
    const output = renderTree(graph, scores, ROOT, opts);
    // Count how many file headers appear — each must be complete (have closing blank line)
    // A partial file would show a header with no definitions or trailing newline
    // We verify the last included file is fully formed by checking no truncated lines
    expect(output).not.toContain('[partial]');
    // Verify the output ends with the footer (not mid-file content)
    expect(output.trimEnd()).toMatch(/\[~\d+ tokens\]$/);
  });

  it('with a very small budget (100 tokens), only the highest-ranked file appears', () => {
    const { graph, scores } = makeLargeGraph(50);
    const opts: TreeRendererOptions = { tokenBudget: 100, charsPerToken: 3 };
    const output = renderTree(graph, scores, ROOT, opts);
    // file0 has the highest score (1/1 = 1.0), should be included
    expect(output).toContain('src/file0.ts');
    // file49 should not be included with such a small budget
    expect(output).not.toContain('src/file49.ts');
  });

  it('with a very large budget, all files appear', () => {
    const fileCount = 5;
    const { graph, scores } = makeLargeGraph(fileCount);
    const opts: TreeRendererOptions = {
      tokenBudget: 1_000_000,
      charsPerToken: 3,
    };
    const output = renderTree(graph, scores, ROOT, opts);
    for (let i = 0; i < fileCount; i++) {
      expect(output).toContain(`src/file${i}.ts`);
    }
  });
});
