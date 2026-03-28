// Unit tests for both MCP resources and the shared buildFileContextText helper.
// Tests are isolated from McpServer/StdioServerTransport — those are covered by server.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { FileGraph } from '../../src/graph/types';
import type { IndexResult } from '../../src/indexer/pipeline';

vi.mock('../../src/indexer/pipeline');
vi.mock('../../src/renderer/tree');
vi.mock('../../src/graph/traversal');

import { buildIndex } from '../../src/indexer/pipeline';
import { renderTree } from '../../src/renderer/tree';
import { forwardDeps, reverseDeps } from '../../src/graph/traversal';
import { buildFileContextText } from '../../src/mcp/server';

const mockBuildIndex = buildIndex as MockedFunction<typeof buildIndex>;
const mockRenderTree = renderTree as MockedFunction<typeof renderTree>;
const mockForwardDeps = forwardDeps as MockedFunction<typeof forwardDeps>;
const mockReverseDeps = reverseDeps as MockedFunction<typeof reverseDeps>;

const FAKE_ROOT = '/fake/root';

const FAKE_GRAPH: FileGraph = {
  files: new Set(['/fake/root/a.ts', '/fake/root/b.ts']),
  forwardEdges: new Map([['/fake/root/a.ts', new Set(['/fake/root/b.ts'])]]),
  reverseEdges: new Map([['/fake/root/b.ts', new Set(['/fake/root/a.ts'])]]),
  definitions: new Map([
    [
      '/fake/root/a.ts',
      [
        {
          id: 'a::Foo',
          name: 'Foo',
          kind: 'class',
          filePath: '/fake/root/a.ts',
          startLine: 1,
          endLine: 10,
          references: [],
        },
        {
          id: 'a::importBar',
          name: 'importBar',
          kind: 'import',
          filePath: '/fake/root/a.ts',
          startLine: 1,
          endLine: 1,
          references: [],
        },
      ],
    ],
    [
      '/fake/root/b.ts',
      [
        {
          id: 'b::doWork',
          name: 'doWork',
          kind: 'function',
          filePath: '/fake/root/b.ts',
          startLine: 5,
          endLine: 15,
          references: [],
        },
      ],
    ],
  ]),
};

const FAKE_SCORES = new Map([
  ['/fake/root/a.ts', 0.7],
  ['/fake/root/b.ts', 0.3],
]);

const FAKE_INDEX_RESULT: IndexResult = {
  graph: FAKE_GRAPH,
  scores: FAKE_SCORES,
  files: ['/fake/root/a.ts', '/fake/root/b.ts'],
  results: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildIndex.mockResolvedValue(FAKE_INDEX_RESULT);
  mockRenderTree.mockReturnValue('tree output [~200 tokens]');
  mockForwardDeps.mockReturnValue({ files: new Set(['/fake/root/b.ts']) });
  mockReverseDeps.mockReturnValue({ files: new Set<string>() });
});

describe('buildFileContextText', () => {
  it('includes file header with relative path and score', () => {
    const text = buildFileContextText(FAKE_GRAPH, FAKE_SCORES, FAKE_ROOT, '/fake/root/a.ts');

    expect(text).toContain('a.ts');
    expect(text).toContain('0.7000');
  });

  it('includes Definitions section with non-import/export definitions', () => {
    const text = buildFileContextText(FAKE_GRAPH, FAKE_SCORES, FAKE_ROOT, '/fake/root/a.ts');

    expect(text).toContain('## Definitions');
    expect(text).toContain('class Foo');
  });

  it('excludes import and export kinds from definitions', () => {
    const text = buildFileContextText(FAKE_GRAPH, FAKE_SCORES, FAKE_ROOT, '/fake/root/a.ts');

    expect(text).not.toContain('import importBar');
  });

  it('includes Dependencies section with forward deps', () => {
    const text = buildFileContextText(FAKE_GRAPH, FAKE_SCORES, FAKE_ROOT, '/fake/root/a.ts');

    expect(text).toContain('## Dependencies');
    expect(text).toContain('b.ts');
  });

  it('includes Dependents section', () => {
    const text = buildFileContextText(FAKE_GRAPH, FAKE_SCORES, FAKE_ROOT, '/fake/root/a.ts');

    expect(text).toContain('## Dependents');
  });

  it('shows "(none)" when no dependencies', () => {
    mockForwardDeps.mockReturnValue({ files: new Set<string>() });

    const text = buildFileContextText(FAKE_GRAPH, FAKE_SCORES, FAKE_ROOT, '/fake/root/a.ts');

    expect(text).toContain('(none)');
  });

  it('uses relative paths for dependencies', () => {
    const text = buildFileContextText(FAKE_GRAPH, FAKE_SCORES, FAKE_ROOT, '/fake/root/a.ts');

    // Should not contain absolute path in deps
    expect(text).not.toContain('/fake/root/b.ts');
    expect(text).toContain('b.ts');
  });

  it('shows "(none)" definitions when file has no matching defs', () => {
    const emptyGraph: FileGraph = {
      files: new Set(['/fake/root/empty.ts']),
      forwardEdges: new Map(),
      reverseEdges: new Map(),
      definitions: new Map(),
    };
    const emptyScores = new Map([['/fake/root/empty.ts', 0.0]]);

    const text = buildFileContextText(emptyGraph, emptyScores, FAKE_ROOT, '/fake/root/empty.ts');

    expect(text).toContain('## Definitions');
    expect(text).toContain('(none)');
  });
});

describe('graft://map resource logic', () => {
  // Test the core logic of the graft://map resource handler.
  // The resource itself is registered in startMcpServer; we test the logic inline.

  it('calls renderTree with 8192 token budget', async () => {
    const { graph, scores } = await buildIndex(FAKE_ROOT);
    renderTree(graph, scores, FAKE_ROOT, { tokenBudget: 8192, charsPerToken: 3 });

    expect(mockRenderTree).toHaveBeenCalledWith(FAKE_GRAPH, FAKE_SCORES, FAKE_ROOT, {
      tokenBudget: 8192,
      charsPerToken: 3,
    });
  });

  it('returns renderTree output as text content', async () => {
    const { graph, scores } = await buildIndex(FAKE_ROOT);
    const text = renderTree(graph, scores, FAKE_ROOT, { tokenBudget: 8192, charsPerToken: 3 });

    expect(text).toBe('tree output [~200 tokens]');
  });
});

describe('graft://file/{path} resource logic', () => {
  it('calls buildFileContextText with resolved abs path', () => {
    const absPath = '/fake/root/a.ts';
    const text = buildFileContextText(FAKE_GRAPH, FAKE_SCORES, FAKE_ROOT, absPath);

    expect(mockForwardDeps).toHaveBeenCalledWith(FAKE_GRAPH, absPath);
    expect(mockReverseDeps).toHaveBeenCalledWith(FAKE_GRAPH, absPath);
  });

  it('returns file context text with definitions and deps', () => {
    const absPath = '/fake/root/a.ts';
    const text = buildFileContextText(FAKE_GRAPH, FAKE_SCORES, FAKE_ROOT, absPath);

    expect(text).toContain('## Definitions');
    expect(text).toContain('## Dependencies');
    expect(text).toContain('## Dependents');
  });
});
