// Targeted coverage tests for uncovered branches in src/cache/index.ts.
// Covers:
//   - line 113: corrupted JSON → readCache returns null
//   - line 160: stat fails for file referenced in cache → isCacheValid returns false

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { readCache, isCacheValid, CACHE_VERSION } from '../../src/cache/index.js';
import type { CacheEntry } from '../../src/cache/index.js';

let tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'graft-test-'));
  tempDirs.push(dir);
  return dir;
}

describe('readCache coverage gaps', () => {
  it('returns null for corrupted JSON cache file (JSON parse catch branch)', async () => {
    const rootDir = await makeTempDir();
    const cacheDir = path.join(rootDir, '.graft');
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(path.join(cacheDir, 'cache.json'), '{{{bad json', 'utf-8');

    const result = await readCache(rootDir);
    expect(result).toBeNull();
  });

  it('throws when cache file has a non-ENOENT read error (line 113 throw branch)', async () => {
    const rootDir = await makeTempDir();
    const cacheDir = path.join(rootDir, '.graft');
    await fs.mkdir(cacheDir, { recursive: true });
    // Create a directory named cache.json — reading it throws EISDIR (not ENOENT)
    await fs.mkdir(path.join(cacheDir, 'cache.json'));

    await expect(readCache(rootDir)).rejects.toThrow();
  });

  it('returns null when cache file has valid JSON but missing version field', async () => {
    const rootDir = await makeTempDir();
    const cacheDir = path.join(rootDir, '.graft');
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      path.join(cacheDir, 'cache.json'),
      JSON.stringify({ data: 'no version field' }),
      'utf-8',
    );

    const result = await readCache(rootDir);
    expect(result).toBeNull();
  });

  it('returns null when cache file does not exist', async () => {
    const rootDir = await makeTempDir();
    const result = await readCache(rootDir);
    expect(result).toBeNull();
  });
});

describe('isCacheValid coverage gaps', () => {
  it('returns false when a cached file no longer exists on disk (stat catch branch, line 168)', async () => {
    const rootDir = await makeTempDir();
    const ghostFile = path.join(rootDir, 'deleted.ts');
    const relPath = path.relative(rootDir, ghostFile);

    const cached: CacheEntry = {
      version: CACHE_VERSION,
      createdAt: new Date().toISOString(),
      fingerprints: {
        [relPath]: { mtimeMs: 1000, size: 512 },
      },
      parseResults: [],
    };

    // ghostFile is in the fingerprints but never written to disk — stat throws ENOENT
    // Exercises the catch { return false } at line 168
    const valid = await isCacheValid(cached, rootDir, [ghostFile]);
    expect(valid).toBe(false);
  });

  it('returns false when current file has no entry in cached fingerprints (line 160 branch)', async () => {
    const rootDir = await makeTempDir();
    const fileA = path.join(rootDir, 'a.ts');
    // fingerprints only has 'b.ts', not 'a.ts' — cachedFp will be undefined for a.ts
    const cached: CacheEntry = {
      version: CACHE_VERSION,
      createdAt: new Date().toISOString(),
      fingerprints: {
        'b.ts': { mtimeMs: 1000, size: 512 },
      },
      parseResults: [],
    };
    // Pass matching count (1 file) but with a different file than what's in fingerprints
    const valid = await isCacheValid(cached, rootDir, [fileA]);
    expect(valid).toBe(false);
  });

  it('returns false when file set size differs from cache', async () => {
    const rootDir = await makeTempDir();

    const cached: CacheEntry = {
      version: CACHE_VERSION,
      createdAt: new Date().toISOString(),
      fingerprints: {
        'a.ts': { mtimeMs: 1000, size: 100 },
        'b.ts': { mtimeMs: 2000, size: 200 },
      },
      parseResults: [],
    };

    // Only one file passed — size mismatch returns false
    const valid = await isCacheValid(cached, rootDir, [path.join(rootDir, 'a.ts')]);
    expect(valid).toBe(false);
  });

  it('returns false when cache version does not match CACHE_VERSION', async () => {
    const rootDir = await makeTempDir();

    const cached: CacheEntry = {
      version: 999,
      createdAt: new Date().toISOString(),
      fingerprints: {},
      parseResults: [],
    };

    const valid = await isCacheValid(cached, rootDir, []);
    expect(valid).toBe(false);
  });
});
