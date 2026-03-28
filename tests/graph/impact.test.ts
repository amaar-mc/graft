// Tests for transitiveClosure — transitive reverse-dependency impact analysis.
// Uses a makeGraph helper to construct FileGraph fixtures directly (no real parsing).

import { describe, it, expect } from 'vitest';
import { transitiveClosure } from '../../src/graph/traversal.js';
import type { FileGraph } from '../../src/graph/types.js';

// Build a FileGraph from directed edge pairs [importer, imported].
// importer -> imported means importer has a forwardEdge to imported,
// and imported has a reverseEdge from importer.
function makeGraph(edges: [string, string][]): FileGraph {
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

  return {
    files,
    forwardEdges: forwardEdgesRaw,
    reverseEdges: reverseEdgesRaw,
    definitions: new Map(),
  };
}

// Build a FileGraph that includes isolated nodes (no edges).
function makeGraphWithIsolated(
  edges: [string, string][],
  isolated: string[],
): FileGraph {
  const base = makeGraph(edges);
  const files = new Set(base.files);
  const forwardEdges = new Map(
    base.forwardEdges as Map<string, Set<string>>,
  );
  const reverseEdges = new Map(
    base.reverseEdges as Map<string, Set<string>>,
  );
  for (const node of isolated) {
    files.add(node);
    if (!forwardEdges.has(node)) forwardEdges.set(node, new Set());
    if (!reverseEdges.has(node)) reverseEdges.set(node, new Set());
  }
  return { files, forwardEdges, reverseEdges, definitions: new Map() };
}

describe('transitiveClosure', () => {
  it('leaf file with no reverse deps returns only that file', () => {
    // A -> B -> C chain: A is a leaf in the reverse direction (nothing imports A).
    // Changing A only affects A itself — no file imports it.
    const graph = makeGraph([
      ['a.ts', 'b.ts'],
      ['b.ts', 'c.ts'],
    ]);
    const result = transitiveClosure(graph, 'a.ts');
    expect(result.files.has('a.ts')).toBe(true);
    expect(result.files.size).toBe(1);
  });

  it('library file returns all transitive importers via BFS', () => {
    // A -> B, D -> B, B -> C (shared lib). Changing C affects C, B, A, D.
    const graph = makeGraph([
      ['a.ts', 'b.ts'],
      ['d.ts', 'b.ts'],
      ['b.ts', 'c.ts'],
    ]);
    const result = transitiveClosure(graph, 'c.ts');
    expect(result.files.has('c.ts')).toBe(true);
    expect(result.files.has('b.ts')).toBe(true);
    expect(result.files.has('a.ts')).toBe(true);
    expect(result.files.has('d.ts')).toBe(true);
    expect(result.files.size).toBe(4);
  });

  it('linear chain A->B->C: transitiveClosure(C) returns {C, B, A}', () => {
    const graph = makeGraph([
      ['a.ts', 'b.ts'],
      ['b.ts', 'c.ts'],
    ]);
    const result = transitiveClosure(graph, 'c.ts');
    expect(result.files).toEqual(new Set(['a.ts', 'b.ts', 'c.ts']));
  });

  it('diamond pattern: A->B, A->C, B->D, C->D: transitiveClosure(D) returns {D, B, C, A}', () => {
    const graph = makeGraph([
      ['a.ts', 'b.ts'],
      ['a.ts', 'c.ts'],
      ['b.ts', 'd.ts'],
      ['c.ts', 'd.ts'],
    ]);
    const result = transitiveClosure(graph, 'd.ts');
    expect(result.files).toEqual(
      new Set(['a.ts', 'b.ts', 'c.ts', 'd.ts']),
    );
  });

  it('cycle A->B->C->A: transitiveClosure(A) returns {A, B, C} without infinite loop', () => {
    const graph = makeGraph([
      ['a.ts', 'b.ts'],
      ['b.ts', 'c.ts'],
      ['c.ts', 'a.ts'],
    ]);
    const result = transitiveClosure(graph, 'a.ts');
    expect(result.files).toEqual(new Set(['a.ts', 'b.ts', 'c.ts']));
  });

  it('unknown file returns set containing only that file', () => {
    const graph = makeGraph([['a.ts', 'b.ts']]);
    const result = transitiveClosure(graph, 'unknown.ts');
    expect(result.files.has('unknown.ts')).toBe(true);
    expect(result.files.size).toBe(1);
  });

  it('isolated node with no edges returns only itself', () => {
    const graph = makeGraphWithIsolated([], ['standalone.ts']);
    const result = transitiveClosure(graph, 'standalone.ts');
    expect(result.files.has('standalone.ts')).toBe(true);
    expect(result.files.size).toBe(1);
  });
});
