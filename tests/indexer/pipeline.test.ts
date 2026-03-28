import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { FileGraph } from '../../src/graph/types';
import type { ParseResult } from '../../src/parser/types';
import type { CacheEntry } from '../../src/cache/index';

// Mock all modules that buildIndex depends on
vi.mock('../../src/indexer/discovery');
vi.mock('../../src/parser/index');
vi.mock('../../src/graph/index');
vi.mock('../../src/graph/pagerank');
vi.mock('../../src/cache/index');

import { discoverFiles } from '../../src/indexer/discovery';
import { parseFiles } from '../../src/parser/index';
import { buildGraph } from '../../src/graph/index';
import { computePageRank } from '../../src/graph/pagerank';
import { readCache, writeCache, isCacheValid, deserializeResults } from '../../src/cache/index';
import { buildIndex } from '../../src/indexer/pipeline';

const mockDiscoverFiles = discoverFiles as MockedFunction<typeof discoverFiles>;
const mockParseFiles = parseFiles as MockedFunction<typeof parseFiles>;
const mockBuildGraph = buildGraph as MockedFunction<typeof buildGraph>;
const mockComputePageRank = computePageRank as MockedFunction<typeof computePageRank>;
const mockReadCache = readCache as MockedFunction<typeof readCache>;
const mockWriteCache = writeCache as MockedFunction<typeof writeCache>;
const mockIsCacheValid = isCacheValid as MockedFunction<typeof isCacheValid>;
const mockDeserializeResults = deserializeResults as MockedFunction<typeof deserializeResults>;

// Minimal fixtures
const FAKE_ROOT = '/fake/root';
const FAKE_FILES = ['/fake/root/a.ts', '/fake/root/b.ts'];

const FAKE_PARSE_RESULTS: readonly ParseResult[] = [
  {
    filePath: '/fake/root/a.ts',
    nodes: [],
    parseTimeMs: 1,
  },
  {
    filePath: '/fake/root/b.ts',
    nodes: [],
    parseTimeMs: 2,
  },
];

const FAKE_GRAPH: FileGraph = {
  files: new Set(FAKE_FILES),
  forwardEdges: new Map(),
  reverseEdges: new Map(),
  definitions: new Map(),
};

const FAKE_SCORES = new Map([
  ['/fake/root/a.ts', 0.6],
  ['/fake/root/b.ts', 0.4],
]);

const FAKE_CACHE_ENTRY: CacheEntry = {
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  fingerprints: {},
  parseResults: [],
};

describe('buildIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default happy-path setup (cache miss)
    mockDiscoverFiles.mockResolvedValue([...FAKE_FILES]);
    mockReadCache.mockResolvedValue(null);
    mockParseFiles.mockResolvedValue(FAKE_PARSE_RESULTS);
    mockWriteCache.mockResolvedValue(undefined);
    mockBuildGraph.mockReturnValue(FAKE_GRAPH);
    mockComputePageRank.mockReturnValue({
      scores: FAKE_SCORES,
      iterations: 5,
      converged: true,
    });
  });

  describe('return shape', () => {
    it('returns an object with graph, scores, files, and results', async () => {
      const result = await buildIndex(FAKE_ROOT);

      expect(result).toHaveProperty('graph');
      expect(result).toHaveProperty('scores');
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('results');
    });

    it('returns files as the list from discoverFiles', async () => {
      const result = await buildIndex(FAKE_ROOT);
      expect(result.files).toEqual(FAKE_FILES);
    });

    it('returns graph from buildGraph', async () => {
      const result = await buildIndex(FAKE_ROOT);
      expect(result.graph).toBe(FAKE_GRAPH);
    });

    it('returns scores from computePageRank', async () => {
      const result = await buildIndex(FAKE_ROOT);
      expect(result.scores).toBe(FAKE_SCORES);
    });

    it('returns results from parseFiles on cache miss', async () => {
      const result = await buildIndex(FAKE_ROOT);
      expect(result.results).toBe(FAKE_PARSE_RESULTS);
    });
  });

  describe('cache-miss path', () => {
    it('calls parseFiles when cache is null', async () => {
      mockReadCache.mockResolvedValue(null);

      await buildIndex(FAKE_ROOT);

      expect(mockParseFiles).toHaveBeenCalledOnce();
      expect(mockParseFiles).toHaveBeenCalledWith(FAKE_FILES);
    });

    it('calls writeCache after parsing on cache miss', async () => {
      mockReadCache.mockResolvedValue(null);

      await buildIndex(FAKE_ROOT);

      expect(mockWriteCache).toHaveBeenCalledOnce();
      expect(mockWriteCache).toHaveBeenCalledWith(FAKE_ROOT, FAKE_PARSE_RESULTS, FAKE_FILES);
    });

    it('does not call isCacheValid when cache is null', async () => {
      mockReadCache.mockResolvedValue(null);

      await buildIndex(FAKE_ROOT);

      expect(mockIsCacheValid).not.toHaveBeenCalled();
    });

    it('does not call deserializeResults when cache is null', async () => {
      mockReadCache.mockResolvedValue(null);

      await buildIndex(FAKE_ROOT);

      expect(mockDeserializeResults).not.toHaveBeenCalled();
    });
  });

  describe('cache-hit path', () => {
    beforeEach(() => {
      mockReadCache.mockResolvedValue(FAKE_CACHE_ENTRY);
      mockIsCacheValid.mockResolvedValue(true);
      mockDeserializeResults.mockReturnValue(FAKE_PARSE_RESULTS);
    });

    it('skips parseFiles when cache is valid', async () => {
      await buildIndex(FAKE_ROOT);

      expect(mockParseFiles).not.toHaveBeenCalled();
    });

    it('skips writeCache when cache is valid', async () => {
      await buildIndex(FAKE_ROOT);

      expect(mockWriteCache).not.toHaveBeenCalled();
    });

    it('calls deserializeResults with cached entry and rootDir', async () => {
      await buildIndex(FAKE_ROOT);

      expect(mockDeserializeResults).toHaveBeenCalledOnce();
      expect(mockDeserializeResults).toHaveBeenCalledWith(FAKE_CACHE_ENTRY, FAKE_ROOT);
    });

    it('returns results from deserializeResults on cache hit', async () => {
      const result = await buildIndex(FAKE_ROOT);
      expect(result.results).toBe(FAKE_PARSE_RESULTS);
    });
  });

  describe('stale cache path (cache exists but invalid)', () => {
    beforeEach(() => {
      mockReadCache.mockResolvedValue(FAKE_CACHE_ENTRY);
      mockIsCacheValid.mockResolvedValue(false);
    });

    it('calls parseFiles when cache is stale', async () => {
      await buildIndex(FAKE_ROOT);

      expect(mockParseFiles).toHaveBeenCalledOnce();
    });

    it('calls writeCache when cache is stale', async () => {
      await buildIndex(FAKE_ROOT);

      expect(mockWriteCache).toHaveBeenCalledOnce();
    });

    it('does not call deserializeResults when cache is stale', async () => {
      await buildIndex(FAKE_ROOT);

      expect(mockDeserializeResults).not.toHaveBeenCalled();
    });
  });

  describe('personalization', () => {
    it('passes personalization map to computePageRank when provided', async () => {
      const personalization = new Map([
        ['/fake/root/a.ts', 0.9],
        ['/fake/root/b.ts', 0.1],
      ]);

      await buildIndex(FAKE_ROOT, personalization);

      expect(mockComputePageRank).toHaveBeenCalledOnce();
      const callArgs = mockComputePageRank.mock.calls[0]!;
      expect(callArgs[1]).toMatchObject({ personalization });
    });

    it('passes undefined personalization when not provided', async () => {
      await buildIndex(FAKE_ROOT);

      expect(mockComputePageRank).toHaveBeenCalledOnce();
      const callArgs = mockComputePageRank.mock.calls[0]!;
      expect(callArgs[1]).toMatchObject({ personalization: undefined });
    });

    it('uses correct default PageRank options', async () => {
      await buildIndex(FAKE_ROOT);

      const callArgs = mockComputePageRank.mock.calls[0]!;
      expect(callArgs[1]).toMatchObject({
        alpha: 0.85,
        maxIterations: 100,
        tolerance: 1e-6,
      });
    });
  });

  describe('pipeline ordering', () => {
    it('calls discoverFiles before readCache', async () => {
      const callOrder: string[] = [];
      mockDiscoverFiles.mockImplementation(async () => {
        callOrder.push('discoverFiles');
        return [...FAKE_FILES];
      });
      mockReadCache.mockImplementation(async () => {
        callOrder.push('readCache');
        return null;
      });
      mockParseFiles.mockImplementation(async () => {
        callOrder.push('parseFiles');
        return FAKE_PARSE_RESULTS;
      });

      await buildIndex(FAKE_ROOT);

      expect(callOrder[0]).toBe('discoverFiles');
      expect(callOrder[1]).toBe('readCache');
      expect(callOrder[2]).toBe('parseFiles');
    });

    it('calls buildGraph after getting parse results', async () => {
      await buildIndex(FAKE_ROOT);

      expect(mockBuildGraph).toHaveBeenCalledOnce();
      expect(mockBuildGraph).toHaveBeenCalledWith(FAKE_PARSE_RESULTS);
    });

    it('calls computePageRank after buildGraph', async () => {
      await buildIndex(FAKE_ROOT);

      expect(mockComputePageRank).toHaveBeenCalledOnce();
      expect(mockComputePageRank).toHaveBeenCalledWith(FAKE_GRAPH, expect.any(Object));
    });
  });
});
