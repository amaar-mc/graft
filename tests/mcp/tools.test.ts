// Unit tests for all 5 MCP tool handlers.
// Tests are isolated from McpServer/StdioServerTransport — those are covered by server.test.ts.
// Handler functions are extracted and tested directly for logic and formatting.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { FileGraph } from '../../src/graph/types';
import type { IndexResult } from '../../src/indexer/pipeline';

vi.mock('../../src/indexer/pipeline');
vi.mock('../../src/renderer/tree');
vi.mock('../../src/graph/traversal');

import { buildIndex } from '../../src/indexer/pipeline';
import { renderTree } from '../../src/renderer/tree';
import { forwardDeps, reverseDeps, transitiveClosure } from '../../src/graph/traversal';
import {
  handleGraftMap,
  handleGraftContext,
  handleGraftSearch,
  handleGraftImpact,
  handleGraftSummary,
} from '../../src/mcp/server';

const mockBuildIndex = buildIndex as MockedFunction<typeof buildIndex>;
const mockRenderTree = renderTree as MockedFunction<typeof renderTree>;
const mockForwardDeps = forwardDeps as MockedFunction<typeof forwardDeps>;
const mockReverseDeps = reverseDeps as MockedFunction<typeof reverseDeps>;
const mockTransitiveClosure = transitiveClosure as MockedFunction<typeof transitiveClosure>;

const FAKE_ROOT = '/fake/root';

const FAKE_GRAPH: FileGraph = {
  files: new Set(['/fake/root/a.ts', '/fake/root/b.ts', '/fake/root/c.ts']),
  forwardEdges: new Map([
    ['/fake/root/a.ts', new Set(['/fake/root/b.ts'])],
    ['/fake/root/b.ts', new Set(['/fake/root/c.ts'])],
  ]),
  reverseEdges: new Map([
    ['/fake/root/b.ts', new Set(['/fake/root/a.ts'])],
    ['/fake/root/c.ts', new Set(['/fake/root/b.ts'])],
  ]),
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
          id: 'a::doStuff',
          name: 'doStuff',
          kind: 'function',
          filePath: '/fake/root/a.ts',
          startLine: 12,
          endLine: 20,
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
          id: 'b::Bar',
          name: 'Bar',
          kind: 'interface',
          filePath: '/fake/root/b.ts',
          startLine: 1,
          endLine: 5,
          references: [],
        },
      ],
    ],
  ]),
};

const FAKE_SCORES = new Map([
  ['/fake/root/a.ts', 0.6],
  ['/fake/root/b.ts', 0.3],
  ['/fake/root/c.ts', 0.1],
]);

const FAKE_INDEX_RESULT: IndexResult = {
  graph: FAKE_GRAPH,
  scores: FAKE_SCORES,
  files: ['/fake/root/a.ts', '/fake/root/b.ts', '/fake/root/c.ts'],
  results: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildIndex.mockResolvedValue(FAKE_INDEX_RESULT);
  mockRenderTree.mockReturnValue('rendered tree output\n[~100 tokens]');
  mockForwardDeps.mockReturnValue({ files: new Set(['/fake/root/b.ts']) });
  mockReverseDeps.mockReturnValue({ files: new Set(['/fake/root/a.ts']) });
  mockTransitiveClosure.mockReturnValue({
    files: new Set(['/fake/root/a.ts', '/fake/root/b.ts', '/fake/root/c.ts']),
  });
});

describe('handleGraftMap', () => {
  it('calls buildIndex with rootDir when no query provided', async () => {
    await handleGraftMap({}, FAKE_ROOT);

    expect(mockBuildIndex).toHaveBeenCalledOnce();
    expect(mockBuildIndex).toHaveBeenCalledWith(FAKE_ROOT, undefined);
  });

  it('calls buildIndex with personalization map when query is provided', async () => {
    await handleGraftMap({ query: 'a.ts' }, FAKE_ROOT);

    expect(mockBuildIndex).toHaveBeenCalledOnce();
    const callArgs = mockBuildIndex.mock.calls[0]!;
    expect(callArgs[0]).toBe(FAKE_ROOT);
    const personalization = callArgs[1];
    expect(personalization).toBeDefined();
    expect(personalization instanceof Map).toBe(true);
    const entries = Array.from(personalization!.entries());
    expect(entries).toHaveLength(1);
    expect(entries[0]![1]).toBe(10.0);
  });

  it('calls renderTree with default budget 2048 when no budget provided', async () => {
    await handleGraftMap({}, FAKE_ROOT);

    expect(mockRenderTree).toHaveBeenCalledOnce();
    const callArgs = mockRenderTree.mock.calls[0]!;
    expect(callArgs[3]).toMatchObject({ tokenBudget: 2048, charsPerToken: 3 });
  });

  it('calls renderTree with provided budget', async () => {
    await handleGraftMap({ budget: 4096 }, FAKE_ROOT);

    const callArgs = mockRenderTree.mock.calls[0]!;
    expect(callArgs[3]).toMatchObject({ tokenBudget: 4096, charsPerToken: 3 });
  });

  it('returns text content with renderTree output', async () => {
    const result = await handleGraftMap({}, FAKE_ROOT);

    expect(result).toEqual({
      content: [{ type: 'text', text: 'rendered tree output\n[~100 tokens]' }],
    });
  });
});

describe('handleGraftContext', () => {
  it('calls buildIndex with rootDir', async () => {
    await handleGraftContext({ path: 'a.ts' }, FAKE_ROOT);

    expect(mockBuildIndex).toHaveBeenCalledOnce();
    expect(mockBuildIndex).toHaveBeenCalledWith(FAKE_ROOT);
  });

  it('calls forwardDeps and reverseDeps with resolved path', async () => {
    await handleGraftContext({ path: 'a.ts' }, FAKE_ROOT);

    const expectedAbsPath = '/fake/root/a.ts';
    expect(mockForwardDeps).toHaveBeenCalledWith(FAKE_GRAPH, expectedAbsPath);
    expect(mockReverseDeps).toHaveBeenCalledWith(FAKE_GRAPH, expectedAbsPath);
  });

  it('returns text content with definitions section', async () => {
    const result = await handleGraftContext({ path: 'a.ts' }, FAKE_ROOT);

    const text = result.content[0]!.text;
    expect(text).toContain('## Definitions');
    // Should include class and function but not import
    expect(text).toContain('class Foo');
    expect(text).toContain('function doStuff');
    expect(text).not.toContain('import importBar');
  });

  it('returns text content with dependencies section', async () => {
    const result = await handleGraftContext({ path: 'a.ts' }, FAKE_ROOT);

    const text = result.content[0]!.text;
    expect(text).toContain('## Dependencies');
    expect(text).toContain('b.ts');
  });

  it('returns text content with dependents section', async () => {
    const result = await handleGraftContext({ path: 'a.ts' }, FAKE_ROOT);

    const text = result.content[0]!.text;
    expect(text).toContain('## Dependents');
    expect(text).toContain('a.ts');
  });
});

describe('handleGraftSearch', () => {
  it('calls buildIndex with rootDir', async () => {
    await handleGraftSearch({ query: 'Foo' }, FAKE_ROOT);

    expect(mockBuildIndex).toHaveBeenCalledOnce();
    expect(mockBuildIndex).toHaveBeenCalledWith(FAKE_ROOT);
  });

  it('returns matches for query (case-insensitive)', async () => {
    const result = await handleGraftSearch({ query: 'foo' }, FAKE_ROOT);

    const text = result.content[0]!.text;
    expect(text).toContain('Foo');
    expect(text).toContain('a.ts');
  });

  it('filters by kind when provided', async () => {
    const result = await handleGraftSearch({ query: '', kind: 'class' }, FAKE_ROOT);

    const text = result.content[0]!.text;
    expect(text).toContain('class Foo');
    expect(text).not.toContain('interface Bar');
  });

  it('returns match count in response', async () => {
    const result = await handleGraftSearch({ query: '' }, FAKE_ROOT);

    const text = result.content[0]!.text;
    expect(text).toMatch(/\d+ match/);
  });

  it('formats each match as kind name in path:LN', async () => {
    const result = await handleGraftSearch({ query: 'Foo' }, FAKE_ROOT);

    const text = result.content[0]!.text;
    expect(text).toMatch(/class Foo in .+:L\d+/);
  });

  it('returns no matches message when none found', async () => {
    const result = await handleGraftSearch({ query: 'nonexistent_xyz' }, FAKE_ROOT);

    const text = result.content[0]!.text;
    expect(text).toContain('0 match');
  });
});

describe('handleGraftImpact', () => {
  it('calls buildIndex with rootDir', async () => {
    await handleGraftImpact({ path: 'a.ts' }, FAKE_ROOT);

    expect(mockBuildIndex).toHaveBeenCalledOnce();
    expect(mockBuildIndex).toHaveBeenCalledWith(FAKE_ROOT);
  });

  it('calls transitiveClosure with resolved path', async () => {
    await handleGraftImpact({ path: 'a.ts' }, FAKE_ROOT);

    const expectedAbsPath = '/fake/root/a.ts';
    expect(mockTransitiveClosure).toHaveBeenCalledWith(FAKE_GRAPH, expectedAbsPath);
  });

  it('returns text content with affected files', async () => {
    const result = await handleGraftImpact({ path: 'a.ts' }, FAKE_ROOT);

    const text = result.content[0]!.text;
    expect(text).toContain('a.ts');
    expect(text).toContain('b.ts');
    expect(text).toContain('c.ts');
  });

  it('includes scores in output, sorted descending', async () => {
    const result = await handleGraftImpact({ path: 'a.ts' }, FAKE_ROOT);

    const text = result.content[0]!.text;
    const aPos = text.indexOf('a.ts');
    const bPos = text.indexOf('b.ts');
    const cPos = text.indexOf('c.ts');
    // a.ts (score 0.6) should appear before b.ts (0.3) and c.ts (0.1)
    expect(aPos).toBeLessThan(bPos);
    expect(bPos).toBeLessThan(cPos);
  });
});

describe('handleGraftSummary', () => {
  it('calls buildIndex with rootDir', async () => {
    await handleGraftSummary({}, FAKE_ROOT);

    expect(mockBuildIndex).toHaveBeenCalledOnce();
    expect(mockBuildIndex).toHaveBeenCalledWith(FAKE_ROOT);
  });

  it('returns text with project stats section', async () => {
    const result = await handleGraftSummary({}, FAKE_ROOT);

    const text = result.content[0]!.text;
    expect(text).toContain('## Project Stats');
    expect(text).toContain('3'); // 3 files
  });

  it('returns text with key files section', async () => {
    const result = await handleGraftSummary({}, FAKE_ROOT);

    const text = result.content[0]!.text;
    expect(text).toContain('## Key Files');
    expect(text).toContain('a.ts');
  });

  it('returns text with tech stack section', async () => {
    const result = await handleGraftSummary({}, FAKE_ROOT);

    const text = result.content[0]!.text;
    expect(text).toContain('## Tech Stack');
  });

  it('includes file count, definition count, and edge count in stats', async () => {
    const result = await handleGraftSummary({}, FAKE_ROOT);

    const text = result.content[0]!.text;
    // 3 files in graph
    expect(text).toMatch(/Files:\s*3/);
    // 4 definitions total (3 in a.ts + 1 in b.ts)
    expect(text).toMatch(/Definitions:\s*4/);
    // 2 edges (a->b, b->c)
    expect(text).toMatch(/Edges:\s*2/);
  });
});
