// Tests for forwardDeps and reverseDeps traversal queries.
// Uses buildGraph to construct a FileGraph fixture, then verifies query results.

import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/graph/index.js';
import { forwardDeps, reverseDeps } from '../../src/graph/traversal.js';
import type { ParseResult, CodeNode } from '../../src/parser/types.js';

// Helper to create a minimal import CodeNode
function makeImportNode(
  filePath: string,
  name: string,
  references: string[],
): CodeNode {
  return {
    id: `${filePath}:${name}:1`,
    name,
    kind: 'import',
    filePath,
    startLine: 1,
    endLine: 3,
    references,
  };
}

function makeResult(filePath: string, nodes: CodeNode[]): ParseResult {
  return { filePath, nodes, parseTimeMs: 0 };
}

// Fixture: A->B->C, D->B pattern.
// B is a "popular library" file imported by both A and D.
const fileA = '/project/src/a.ts';
const fileB = '/project/src/b.ts';
const fileC = '/project/src/c.ts';
const fileD = '/project/src/d.ts';
const fileUnknown = '/project/src/unknown.ts';

// import node: name = module path, references = imported identifiers
const fixtureResults: ParseResult[] = [
  makeResult(fileA, [makeImportNode(fileA, './b', ['foo'])]),
  makeResult(fileB, [makeImportNode(fileB, './c', ['bar'])]),
  makeResult(fileC, []),
  makeResult(fileD, [makeImportNode(fileD, './b', ['foo'])]),
];

const graph = buildGraph(fixtureResults);

describe('forwardDeps', () => {
  it('returns direct imports of a file that has imports', () => {
    const result = forwardDeps(graph, fileA);
    expect(result.files.has(fileB)).toBe(true);
    expect(result.files.size).toBe(1);
  });

  it('returns both imports for file B (imports C)', () => {
    const result = forwardDeps(graph, fileB);
    expect(result.files.has(fileC)).toBe(true);
    expect(result.files.size).toBe(1);
  });

  it('returns empty set for file with no imports', () => {
    const result = forwardDeps(graph, fileC);
    expect(result.files.size).toBe(0);
  });

  it('returns empty set for unknown file without throwing', () => {
    const result = forwardDeps(graph, fileUnknown);
    expect(result.files.size).toBe(0);
  });
});

describe('reverseDeps', () => {
  it('returns all files that import a given file', () => {
    // Both A and D import B
    const result = reverseDeps(graph, fileB);
    expect(result.files.has(fileA)).toBe(true);
    expect(result.files.has(fileD)).toBe(true);
    expect(result.files.size).toBe(2);
  });

  it('returns single importer for file C (only B imports it)', () => {
    const result = reverseDeps(graph, fileC);
    expect(result.files.has(fileB)).toBe(true);
    expect(result.files.size).toBe(1);
  });

  it('returns empty set for file with no importers', () => {
    // A is not imported by anyone
    const result = reverseDeps(graph, fileA);
    expect(result.files.size).toBe(0);
  });

  it('returns empty set for unknown file without throwing', () => {
    const result = reverseDeps(graph, fileUnknown);
    expect(result.files.size).toBe(0);
  });
});
