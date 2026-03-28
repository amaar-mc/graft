// Vitest snapshot tests for renderTree output.
// Builds all graphs from in-memory data (no filesystem fixtures) to ensure
// stable, deterministic snapshots across machines.
// Each snapshot captures a distinct rendering scenario; changes to renderTree
// formatting will cause snapshot failures, catching regressions automatically.

import { describe, it, expect } from 'vitest';
import { renderTree } from '../../src/renderer/tree.js';
import type { FileGraph, TreeRendererOptions } from '../../src/graph/types.js';
import type { CodeNode } from '../../src/parser/types.js';

const ROOT = '/project';

const DEFAULT_OPTS: TreeRendererOptions = {
  tokenBudget: 2048,
  charsPerToken: 3,
};

// Build a minimal CodeNode. Definitions use non-import/export kinds to appear in output.
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

// Build a minimal FileGraph from given file paths and definitions.
// Edges are empty — renderTree only uses files and definitions.
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

// ── Scenario 1: Standard 3-file graph ─────────────────────────────────────────

describe('tree renderer snapshots', () => {
  it('renders standard 3-file graph', () => {
    const fileA = `${ROOT}/src/a.ts`;
    const fileB = `${ROOT}/src/b.ts`;
    const fileC = `${ROOT}/src/c.ts`;

    const defs = new Map<string, CodeNode[]>([
      [
        fileA,
        [
          makeNode(fileA, 'doWork', 'function', 5, 20),
          makeNode(fileA, 'MyClass', 'class', 25, 50),
        ],
      ],
      [fileB, [makeNode(fileB, 'helper', 'function', 2, 10)]],
      [fileC, [makeNode(fileC, 'Config', 'interface', 1, 8)]],
    ]);

    const scores: ReadonlyMap<string, number> = new Map([
      [fileA, 0.5],
      [fileB, 0.3],
      [fileC, 0.1],
    ]);

    const graph = makeGraph([fileA, fileB, fileC], defs);
    const output = renderTree(graph, scores, ROOT, DEFAULT_OPTS);

    expect(output).toMatchSnapshot();
  });

  // ── Scenario 2: Headers only (no definitions) ────────────────────────────────

  it('renders graph with only headers (no definitions)', () => {
    const fileA = `${ROOT}/src/a.ts`;
    const fileB = `${ROOT}/src/b.ts`;
    const fileC = `${ROOT}/src/c.ts`;

    const defs = new Map<string, CodeNode[]>([
      [fileA, []],
      [fileB, []],
      [fileC, []],
    ]);

    const scores: ReadonlyMap<string, number> = new Map([
      [fileA, 0.6],
      [fileB, 0.25],
      [fileC, 0.15],
    ]);

    const graph = makeGraph([fileA, fileB, fileC], defs);
    const output = renderTree(graph, scores, ROOT, DEFAULT_OPTS);

    expect(output).toMatchSnapshot();
  });

  // ── Scenario 3: Single-file graph ────────────────────────────────────────────

  it('renders single-file graph', () => {
    const fileA = `${ROOT}/src/main.ts`;

    const defs = new Map<string, CodeNode[]>([
      [
        fileA,
        [
          makeNode(fileA, 'bootstrap', 'function', 1, 15),
          makeNode(fileA, 'AppConfig', 'interface', 17, 25),
          makeNode(fileA, 'VERSION', 'constant', 27, 27),
        ],
      ],
    ]);

    const scores: ReadonlyMap<string, number> = new Map([[fileA, 1.0]]);

    const graph = makeGraph([fileA], defs);
    const output = renderTree(graph, scores, ROOT, DEFAULT_OPTS);

    expect(output).toMatchSnapshot();
  });

  // ── Scenario 4: Tight budget that truncates output ───────────────────────────

  it('renders with tight budget that truncates', () => {
    const fileA = `${ROOT}/src/a.ts`;
    const fileB = `${ROOT}/src/b.ts`;
    const fileC = `${ROOT}/src/c.ts`;

    const defs = new Map<string, CodeNode[]>([
      [fileA, [makeNode(fileA, 'doWork', 'function', 1, 20)]],
      [fileB, [makeNode(fileB, 'helper', 'function', 1, 10)]],
      [fileC, [makeNode(fileC, 'util', 'function', 1, 5)]],
    ]);

    const scores: ReadonlyMap<string, number> = new Map([
      [fileA, 0.5],
      [fileB, 0.3],
      [fileC, 0.2],
    ]);

    // tokenBudget=20 with charsPerToken=3 → charBudget=60, fits first file but not second
    const tightOpts: TreeRendererOptions = { tokenBudget: 20, charsPerToken: 3 };
    const graph = makeGraph([fileA, fileB, fileC], defs);
    const output = renderTree(graph, scores, ROOT, tightOpts);

    expect(output).toMatchSnapshot();
  });

  // ── Scenario 5: Empty graph ───────────────────────────────────────────────────

  it('renders empty graph', () => {
    const emptyGraph = makeGraph([], new Map());
    const emptyScores: ReadonlyMap<string, number> = new Map();
    const output = renderTree(emptyGraph, emptyScores, ROOT, DEFAULT_OPTS);

    expect(output).toMatchSnapshot();
  });
});
