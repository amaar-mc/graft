// Tests for cache read/write with mtime+size fingerprint invalidation.
// Uses real temp files via fs.mkdtemp for accurate stat behavior.

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  readCache,
  writeCache,
  isCacheValid,
  deserializeResults,
} from '../../src/cache/index.js';
import type { CacheEntry } from '../../src/cache/index.js';
import type { ParseResult, CodeNode } from '../../src/parser/types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeNode(filePath: string, name: string): CodeNode {
  return {
    id: `${filePath}:${name}:1`,
    name,
    kind: 'function',
    filePath,
    startLine: 1,
    endLine: 10,
    references: ['dep1', 'dep2'],
  };
}

function makeResult(filePath: string, name: string): ParseResult {
  return {
    filePath,
    nodes: [makeNode(filePath, name)],
    parseTimeMs: 42,
  };
}

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'graft-cache-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  // Clean up all temp dirs created during the test
  for (const dir of tempDirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// ── writeCache ────────────────────────────────────────────────────────────────

describe('writeCache', () => {
  it('creates .graft directory if it does not exist', async () => {
    const rootDir = await makeTempDir();
    const file = path.join(rootDir, 'a.ts');
    await fs.writeFile(file, 'export function a() {}');

    const results: ParseResult[] = [makeResult(file, 'a')];
    await writeCache(rootDir, results, [file]);

    const cacheDir = path.join(rootDir, '.graft');
    const stat = await fs.stat(cacheDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('serializes ParseResult[] with fingerprints to .graft/cache.json', async () => {
    const rootDir = await makeTempDir();
    const file = path.join(rootDir, 'a.ts');
    await fs.writeFile(file, 'export function a() {}');

    const results: ParseResult[] = [makeResult(file, 'a')];
    await writeCache(rootDir, results, [file]);

    const cacheFile = path.join(rootDir, '.graft', 'cache.json');
    const raw = await fs.readFile(cacheFile, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;

    expect(parsed).toBeDefined();
    expect(typeof (parsed as Record<string, unknown>)['version']).toBe('number');
    expect(typeof (parsed as Record<string, unknown>)['fingerprints']).toBe('object');
    expect(Array.isArray((parsed as Record<string, unknown>)['parseResults'])).toBe(true);
  });
});

// ── readCache ─────────────────────────────────────────────────────────────────

describe('readCache', () => {
  it('returns null if cache file does not exist', async () => {
    const rootDir = await makeTempDir();
    const result = await readCache(rootDir);
    expect(result).toBeNull();
  });

  it('returns null if cache JSON is malformed', async () => {
    const rootDir = await makeTempDir();
    await fs.mkdir(path.join(rootDir, '.graft'), { recursive: true });
    await fs.writeFile(path.join(rootDir, '.graft', 'cache.json'), 'not-json');

    const result = await readCache(rootDir);
    expect(result).toBeNull();
  });

  it('returns null if cache JSON lacks version field', async () => {
    const rootDir = await makeTempDir();
    await fs.mkdir(path.join(rootDir, '.graft'), { recursive: true });
    await fs.writeFile(
      path.join(rootDir, '.graft', 'cache.json'),
      JSON.stringify({ fingerprints: {}, parseResults: [] }),
    );

    const result = await readCache(rootDir);
    expect(result).toBeNull();
  });

  it('returns CacheEntry if file is valid JSON matching schema', async () => {
    const rootDir = await makeTempDir();
    const file = path.join(rootDir, 'a.ts');
    await fs.writeFile(file, 'export function a() {}');

    const results: ParseResult[] = [makeResult(file, 'a')];
    await writeCache(rootDir, results, [file]);

    const entry = await readCache(rootDir);
    expect(entry).not.toBeNull();
    expect(typeof entry!.version).toBe('number');
  });
});

// ── isCacheValid ──────────────────────────────────────────────────────────────

describe('isCacheValid', () => {
  it('returns true when all file fingerprints match current stat', async () => {
    const rootDir = await makeTempDir();
    const file = path.join(rootDir, 'a.ts');
    await fs.writeFile(file, 'export function a() {}');

    const results: ParseResult[] = [makeResult(file, 'a')];
    await writeCache(rootDir, results, [file]);

    const entry = (await readCache(rootDir)) as CacheEntry;
    const valid = await isCacheValid(entry, rootDir, [file]);
    expect(valid).toBe(true);
  });

  it('returns false when a file mtime changes', async () => {
    const rootDir = await makeTempDir();
    const file = path.join(rootDir, 'a.ts');
    await fs.writeFile(file, 'export function a() {}');

    const results: ParseResult[] = [makeResult(file, 'a')];
    await writeCache(rootDir, results, [file]);

    const entry = (await readCache(rootDir)) as CacheEntry;

    // Wait a moment then overwrite the file to change mtime
    await new Promise((resolve) => setTimeout(resolve, 10));
    await fs.writeFile(file, 'export function a() { return 1; }');

    const valid = await isCacheValid(entry, rootDir, [file]);
    expect(valid).toBe(false);
  });

  it('returns false when a file size changes', async () => {
    const rootDir = await makeTempDir();
    const file = path.join(rootDir, 'a.ts');
    await fs.writeFile(file, 'export function a() {}');

    const results: ParseResult[] = [makeResult(file, 'a')];
    await writeCache(rootDir, results, [file]);

    const entry = (await readCache(rootDir)) as CacheEntry;

    // Preserve mtime-ish but change size by writing different content with utimes reset
    // Simpler: just use utimes after writing larger content, but that touches mtime too.
    // Easiest: manipulate the entry fingerprints directly to simulate a stale size.
    const tamperedEntry: CacheEntry = {
      ...entry,
      fingerprints: {
        ...entry.fingerprints,
        [Object.keys(entry.fingerprints)[0]!]: {
          mtimeMs: Object.values(entry.fingerprints)[0]!.mtimeMs,
          size: 999999, // wrong size
        },
      },
    };

    const valid = await isCacheValid(tamperedEntry, rootDir, [file]);
    expect(valid).toBe(false);
  });

  it('returns false when a new file is added (not in cache fingerprints)', async () => {
    const rootDir = await makeTempDir();
    const fileA = path.join(rootDir, 'a.ts');
    const fileB = path.join(rootDir, 'b.ts');
    await fs.writeFile(fileA, 'export function a() {}');
    await fs.writeFile(fileB, 'export function b() {}');

    // Cache only has fileA
    const results: ParseResult[] = [makeResult(fileA, 'a')];
    await writeCache(rootDir, results, [fileA]);

    const entry = (await readCache(rootDir)) as CacheEntry;

    // currentFiles now includes both A and B
    const valid = await isCacheValid(entry, rootDir, [fileA, fileB]);
    expect(valid).toBe(false);
  });

  it('returns false when a cached file is deleted (stat throws ENOENT)', async () => {
    const rootDir = await makeTempDir();
    const file = path.join(rootDir, 'a.ts');
    await fs.writeFile(file, 'export function a() {}');

    const results: ParseResult[] = [makeResult(file, 'a')];
    await writeCache(rootDir, results, [file]);

    const entry = (await readCache(rootDir)) as CacheEntry;

    // Delete the file so stat will throw
    await fs.unlink(file);

    const valid = await isCacheValid(entry, rootDir, [file]);
    expect(valid).toBe(false);
  });

  it('returns false when CACHE_VERSION differs from cached version', async () => {
    const rootDir = await makeTempDir();
    const file = path.join(rootDir, 'a.ts');
    await fs.writeFile(file, 'export function a() {}');

    const results: ParseResult[] = [makeResult(file, 'a')];
    await writeCache(rootDir, results, [file]);

    const entry = (await readCache(rootDir)) as CacheEntry;

    // Tamper the version to be something old
    const staleEntry: CacheEntry = { ...entry, version: 0 };

    const valid = await isCacheValid(staleEntry, rootDir, [file]);
    expect(valid).toBe(false);
  });
});

// ── relative path storage ─────────────────────────────────────────────────────

describe('relative path storage', () => {
  it('stores relative paths (not absolute) in cache fingerprints', async () => {
    const rootDir = await makeTempDir();
    const file = path.join(rootDir, 'src', 'a.ts');
    await fs.mkdir(path.join(rootDir, 'src'), { recursive: true });
    await fs.writeFile(file, 'export function a() {}');

    const results: ParseResult[] = [makeResult(file, 'a')];
    await writeCache(rootDir, results, [file]);

    const raw = await fs.readFile(path.join(rootDir, '.graft', 'cache.json'), 'utf-8');
    const parsed = JSON.parse(raw) as CacheEntry;

    // Fingerprint keys should be relative, not absolute
    const keys = Object.keys(parsed.fingerprints);
    expect(keys.length).toBe(1);
    expect(keys[0]).toBe('src/a.ts');
    expect(path.isAbsolute(keys[0]!)).toBe(false);
  });

  it('roundtrip: writeCache + readCache + deserializeResults preserves all ParseResult data with absolute paths', async () => {
    const rootDir = await makeTempDir();
    const file = path.join(rootDir, 'a.ts');
    await fs.writeFile(file, 'export function a() {}');

    const original: ParseResult[] = [makeResult(file, 'a')];
    await writeCache(rootDir, original, [file]);

    const entry = (await readCache(rootDir)) as CacheEntry;
    const restored = deserializeResults(entry, rootDir);

    expect(restored.length).toBe(1);
    expect(restored[0]!.filePath).toBe(file); // absolute path restored
    expect(restored[0]!.nodes.length).toBe(1);
    expect(restored[0]!.nodes[0]!.filePath).toBe(file); // absolute path in nodes
    expect(restored[0]!.nodes[0]!.name).toBe('a');
    expect(restored[0]!.nodes[0]!.references).toEqual(['dep1', 'dep2']);
    expect(restored[0]!.parseTimeMs).toBe(42);
  });
});
