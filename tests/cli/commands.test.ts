// Unit tests for CLI command handler logic.
// Each command handler is exported from src/cli/index.ts for testability.
// Dependencies (buildIndex, renderTree, transitiveClosure, readCache) are mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { FileGraph } from '../../src/graph/types';
import type { CacheEntry } from '../../src/cache/index';

// Mock all dependencies before importing the module under test
vi.mock('../../src/indexer/pipeline');
vi.mock('../../src/renderer/tree');
vi.mock('../../src/graph/traversal');
vi.mock('../../src/cache/index');
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));

import { buildIndex } from '../../src/indexer/pipeline';
import { renderTree } from '../../src/renderer/tree';
import { transitiveClosure } from '../../src/graph/traversal';
import { readCache } from '../../src/cache/index';
import { handleMap, handleStats, handleImpact, handleSearch } from '../../src/cli/index';

const mockBuildIndex = buildIndex as MockedFunction<typeof buildIndex>;
const mockRenderTree = renderTree as MockedFunction<typeof renderTree>;
const mockTransitiveClosure = transitiveClosure as MockedFunction<typeof transitiveClosure>;
const mockReadCache = readCache as MockedFunction<typeof readCache>;

const FAKE_ROOT = '/fake/root';

const FAKE_GRAPH: FileGraph = {
  files: new Set(['/fake/root/a.ts', '/fake/root/b.ts', '/fake/root/c.ts']),
  forwardEdges: new Map([
    ['/fake/root/a.ts', new Set(['/fake/root/b.ts'])],
    ['/fake/root/b.ts', new Set(['/fake/root/c.ts'])],
    ['/fake/root/c.ts', new Set()],
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
          id: '/fake/root/a.ts:foo:1',
          name: 'foo',
          kind: 'function',
          filePath: '/fake/root/a.ts',
          startLine: 1,
          endLine: 5,
          references: [],
        },
        {
          id: '/fake/root/a.ts:Bar:10',
          name: 'Bar',
          kind: 'class',
          filePath: '/fake/root/a.ts',
          startLine: 10,
          endLine: 20,
          references: [],
        },
        {
          id: '/fake/root/a.ts:IBar:25',
          name: 'IBar',
          kind: 'import',
          filePath: '/fake/root/a.ts',
          startLine: 25,
          endLine: 25,
          references: [],
        },
      ],
    ],
    [
      '/fake/root/b.ts',
      [
        {
          id: '/fake/root/b.ts:fooBar:3',
          name: 'fooBar',
          kind: 'function',
          filePath: '/fake/root/b.ts',
          startLine: 3,
          endLine: 8,
          references: [],
        },
        {
          id: '/fake/root/b.ts:MyType:15',
          name: 'MyType',
          kind: 'type',
          filePath: '/fake/root/b.ts',
          startLine: 15,
          endLine: 15,
          references: [],
        },
      ],
    ],
    ['/fake/root/c.ts', []],
  ]),
};

const FAKE_SCORES = new Map([
  ['/fake/root/a.ts', 0.6],
  ['/fake/root/b.ts', 0.3],
  ['/fake/root/c.ts', 0.1],
]);

const FAKE_INDEX_RESULT = {
  graph: FAKE_GRAPH,
  scores: FAKE_SCORES,
  files: ['/fake/root/a.ts', '/fake/root/b.ts', '/fake/root/c.ts'],
  results: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockBuildIndex.mockResolvedValue(FAKE_INDEX_RESULT);
});

// ── handleMap ────────────────────────────────────────────────────────────────

describe('handleMap', () => {
  it('calls buildIndex with rootDir when no focus provided', async () => {
    mockRenderTree.mockReturnValue('tree output');

    await handleMap(FAKE_ROOT, { budget: '2048' });

    expect(mockBuildIndex).toHaveBeenCalledOnce();
    expect(mockBuildIndex).toHaveBeenCalledWith(FAKE_ROOT, undefined);
  });

  it('calls buildIndex with personalization when --focus is provided', async () => {
    mockRenderTree.mockReturnValue('tree output');

    await handleMap(FAKE_ROOT, { focus: '/fake/root/a.ts', budget: '2048' });

    expect(mockBuildIndex).toHaveBeenCalledOnce();
    const [, personalization] = mockBuildIndex.mock.calls[0]!;
    expect(personalization).toBeInstanceOf(Map);
    expect(personalization?.get('/fake/root/a.ts')).toBe(10.0);
  });

  it('calls renderTree with correct tokenBudget from --budget option', async () => {
    mockRenderTree.mockReturnValue('tree output');

    await handleMap(FAKE_ROOT, { budget: '4096' });

    expect(mockRenderTree).toHaveBeenCalledOnce();
    const [, , , options] = mockRenderTree.mock.calls[0]!;
    expect(options.tokenBudget).toBe(4096);
    expect(options.charsPerToken).toBe(3);
  });

  it('returns the renderTree output string', async () => {
    mockRenderTree.mockReturnValue('the tree text');

    const result = await handleMap(FAKE_ROOT, { budget: '2048' });

    expect(result).toBe('the tree text');
  });

  it('uses default budget of 2048 when budget option is "2048"', async () => {
    mockRenderTree.mockReturnValue('tree');

    await handleMap(FAKE_ROOT, { budget: '2048' });

    const [, , , options] = mockRenderTree.mock.calls[0]!;
    expect(options.tokenBudget).toBe(2048);
  });
});

// ── handleStats ──────────────────────────────────────────────────────────────

describe('handleStats', () => {
  it('calls buildIndex with rootDir', async () => {
    mockReadCache.mockResolvedValue(null);

    await handleStats(FAKE_ROOT);

    expect(mockBuildIndex).toHaveBeenCalledOnce();
    expect(mockBuildIndex).toHaveBeenCalledWith(FAKE_ROOT, undefined);
  });

  it('includes file count in output', async () => {
    mockReadCache.mockResolvedValue(null);

    const result = await handleStats(FAKE_ROOT);

    // 3 files in FAKE_GRAPH
    expect(result).toContain('3');
  });

  it('includes definition count excluding import/export kinds', async () => {
    mockReadCache.mockResolvedValue(null);

    const result = await handleStats(FAKE_ROOT);

    // a.ts: foo (function), Bar (class) = 2 non-import/export
    // b.ts: fooBar (function), MyType (type) = 2
    // c.ts: 0
    // Total: 4
    expect(result).toContain('4');
  });

  it('includes edge count from forwardEdges', async () => {
    mockReadCache.mockResolvedValue(null);

    const result = await handleStats(FAKE_ROOT);

    // a.ts -> b.ts (1), b.ts -> c.ts (1), c.ts -> () (0) = 2 edges
    expect(result).toContain('2');
  });

  it('shows "No cache" when readCache returns null', async () => {
    mockReadCache.mockResolvedValue(null);

    const result = await handleStats(FAKE_ROOT);

    expect(result).toContain('No cache');
  });

  it('shows relative age when cache exists', async () => {
    const fakeCache: CacheEntry = {
      version: 1,
      createdAt: new Date(Date.now() - 120_000).toISOString(), // 2 minutes ago
      fingerprints: {},
      parseResults: [],
    };
    mockReadCache.mockResolvedValue(fakeCache);

    const result = await handleStats(FAKE_ROOT);

    // Should contain "ago" in relative time
    expect(result).toContain('ago');
  });
});

// ── handleImpact ─────────────────────────────────────────────────────────────

describe('handleImpact', () => {
  it('calls buildIndex with rootDir', async () => {
    mockTransitiveClosure.mockReturnValue({
      files: new Set(['/fake/root/a.ts']),
    });

    await handleImpact(FAKE_ROOT, '/fake/root/a.ts');

    expect(mockBuildIndex).toHaveBeenCalledOnce();
    expect(mockBuildIndex).toHaveBeenCalledWith(FAKE_ROOT, undefined);
  });

  it('calls transitiveClosure with resolved absolute path', async () => {
    mockTransitiveClosure.mockReturnValue({
      files: new Set(['/fake/root/a.ts']),
    });

    await handleImpact(FAKE_ROOT, '/fake/root/b.ts');

    expect(mockTransitiveClosure).toHaveBeenCalledOnce();
    expect(mockTransitiveClosure).toHaveBeenCalledWith(FAKE_GRAPH, '/fake/root/b.ts');
  });

  it('includes affected file paths in output', async () => {
    mockTransitiveClosure.mockReturnValue({
      files: new Set(['/fake/root/a.ts', '/fake/root/b.ts']),
    });

    const result = await handleImpact(FAKE_ROOT, '/fake/root/b.ts');

    expect(result).toContain('a.ts');
    expect(result).toContain('b.ts');
  });

  it('sorts affected files by score descending', async () => {
    mockTransitiveClosure.mockReturnValue({
      files: new Set(['/fake/root/b.ts', '/fake/root/a.ts']),
    });

    const result = await handleImpact(FAKE_ROOT, '/fake/root/b.ts');

    // a.ts has score 0.6, b.ts has score 0.3 — a.ts should appear first
    const aIdx = result.indexOf('a.ts');
    const bIdx = result.indexOf('b.ts');
    expect(aIdx).toBeLessThan(bIdx);
  });

  it('includes total count of affected files', async () => {
    mockTransitiveClosure.mockReturnValue({
      files: new Set(['/fake/root/a.ts', '/fake/root/b.ts']),
    });

    const result = await handleImpact(FAKE_ROOT, '/fake/root/b.ts');

    expect(result).toContain('2');
  });
});

// ── handleSearch ─────────────────────────────────────────────────────────────

describe('handleSearch', () => {
  it('calls buildIndex with rootDir', async () => {
    await handleSearch(FAKE_ROOT, 'foo', {});

    expect(mockBuildIndex).toHaveBeenCalledOnce();
    expect(mockBuildIndex).toHaveBeenCalledWith(FAKE_ROOT, undefined);
  });

  it('returns definitions matching query case-insensitively', async () => {
    const result = await handleSearch(FAKE_ROOT, 'FOO', {});

    // Should match 'foo' and 'fooBar'
    expect(result).toContain('foo');
    expect(result).toContain('fooBar');
  });

  it('filters by --kind when provided', async () => {
    const result = await handleSearch(FAKE_ROOT, 'foo', { kind: 'function' });

    // 'foo' (function) matches; 'fooBar' (function) matches too
    expect(result).toContain('foo');
    expect(result).toContain('fooBar');
  });

  it('excludes definitions not matching --kind filter', async () => {
    const result = await handleSearch(FAKE_ROOT, 'Bar', { kind: 'function' });

    // 'Bar' is class kind — should be excluded when filtering by 'function'
    expect(result).not.toContain('Bar');
  });

  it('includes kind, name, relative path, and line number in output', async () => {
    const result = await handleSearch(FAKE_ROOT, 'foo', { kind: 'function' });

    // Should include function foo in a.ts at line 1
    expect(result).toContain('function');
    expect(result).toContain('foo');
    expect(result).toContain('a.ts');
    expect(result).toContain('L1');
  });

  it('includes match count in output', async () => {
    const result = await handleSearch(FAKE_ROOT, 'foo', {});

    // 'foo' and 'fooBar' match — expect count "2" in output
    expect(result).toContain('2');
  });

  it('returns empty result message when no matches found', async () => {
    const result = await handleSearch(FAKE_ROOT, 'xyz_nonexistent', {});

    expect(result).toContain('0');
  });
});
