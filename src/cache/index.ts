// Filesystem cache for parsed results.
// Persists ParseResult[] to .graft/cache.json with mtime+size fingerprints
// so subsequent runs can skip re-parsing unchanged files.

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ParseResult, CodeNode } from '../parser/types.js';

// Bump this constant whenever the CacheEntry schema changes.
// Any cached file with a different version will be fully invalidated.
const CACHE_VERSION = 1;
const CACHE_DIR = '.graft';
const CACHE_FILENAME = 'cache.json';

// ── internal types ────────────────────────────────────────────────────────────

interface FileFingerprint {
  readonly mtimeMs: number;
  readonly size: number;
}

// Like CodeNode but with relative filePath for portability across machines.
interface SerializedCodeNode {
  readonly id: string;
  readonly name: string;
  readonly kind: CodeNode['kind'];
  readonly filePath: string; // relative to rootDir
  readonly startLine: number;
  readonly endLine: number;
  readonly references: readonly string[];
}

// Like ParseResult but with relative filePath and serialized nodes.
interface SerializedParseResult {
  readonly filePath: string; // relative to rootDir
  readonly nodes: readonly SerializedCodeNode[];
  readonly parseTimeMs: number;
}

// ── public types ──────────────────────────────────────────────────────────────

interface CacheEntry {
  readonly version: number;
  readonly createdAt: string;
  // fingerprints keyed by relative file path
  readonly fingerprints: Record<string, FileFingerprint>;
  readonly parseResults: readonly SerializedParseResult[];
}

// ── private helpers ───────────────────────────────────────────────────────────

async function computeFingerprint(filePath: string): Promise<FileFingerprint> {
  const stat = await fs.stat(filePath);
  return { mtimeMs: stat.mtimeMs, size: stat.size };
}

function serializeResult(result: ParseResult, rootDir: string): SerializedParseResult {
  const relFilePath = path.relative(rootDir, result.filePath);
  const nodes: SerializedCodeNode[] = result.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    kind: node.kind,
    filePath: path.relative(rootDir, node.filePath),
    startLine: node.startLine,
    endLine: node.endLine,
    references: node.references,
  }));
  return { filePath: relFilePath, nodes, parseTimeMs: result.parseTimeMs };
}

// ── public API ────────────────────────────────────────────────────────────────

async function writeCache(
  rootDir: string,
  results: readonly ParseResult[],
  filePaths: readonly string[],
): Promise<void> {
  const cacheDir = path.join(rootDir, CACHE_DIR);
  await fs.mkdir(cacheDir, { recursive: true });

  // Build fingerprint map keyed by relative path
  const fingerprints: Record<string, FileFingerprint> = {};
  await Promise.all(
    filePaths.map(async (absPath) => {
      const relPath = path.relative(rootDir, absPath);
      fingerprints[relPath] = await computeFingerprint(absPath);
    }),
  );

  const serializedResults = results.map((r) => serializeResult(r, rootDir));

  const entry: CacheEntry = {
    version: CACHE_VERSION,
    createdAt: new Date().toISOString(),
    fingerprints,
    parseResults: serializedResults,
  };

  const cachePath = path.join(cacheDir, CACHE_FILENAME);
  await fs.writeFile(cachePath, JSON.stringify(entry, null, 2));
}

async function readCache(rootDir: string): Promise<CacheEntry | null> {
  const cachePath = path.join(rootDir, CACHE_DIR, CACHE_FILENAME);
  let raw: string;

  try {
    raw = await fs.readFile(cachePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // Minimal shape validation — version field must be present
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    typeof (parsed as Record<string, unknown>)['version'] !== 'number'
  ) {
    return null;
  }

  return parsed as CacheEntry;
}

async function isCacheValid(
  cached: CacheEntry,
  rootDir: string,
  currentFiles: readonly string[],
): Promise<boolean> {
  // Version mismatch means schema changed — full invalidation
  if (cached.version !== CACHE_VERSION) {
    return false;
  }

  const currentRelPaths = currentFiles.map((f) => path.relative(rootDir, f));

  // File set must match exactly
  const cachedRelPaths = Object.keys(cached.fingerprints);
  if (currentRelPaths.length !== cachedRelPaths.length) {
    return false;
  }

  // Check every current file against its cached fingerprint
  for (const absPath of currentFiles) {
    const relPath = path.relative(rootDir, absPath);
    const cachedFp = cached.fingerprints[relPath];
    if (cachedFp === undefined) {
      // File not in cache — new file added
      return false;
    }

    let currentFp: FileFingerprint;
    try {
      currentFp = await computeFingerprint(absPath);
    } catch {
      // stat failed — file deleted or inaccessible
      return false;
    }

    if (currentFp.mtimeMs !== cachedFp.mtimeMs || currentFp.size !== cachedFp.size) {
      return false;
    }
  }

  return true;
}

function deserializeResults(cached: CacheEntry, rootDir: string): readonly ParseResult[] {
  return cached.parseResults.map((sr) => ({
    filePath: path.resolve(rootDir, sr.filePath),
    nodes: sr.nodes.map((sn) => ({
      id: sn.id,
      name: sn.name,
      kind: sn.kind,
      filePath: path.resolve(rootDir, sn.filePath),
      startLine: sn.startLine,
      endLine: sn.endLine,
      references: sn.references,
    })),
    parseTimeMs: sr.parseTimeMs,
  }));
}

export type { CacheEntry, FileFingerprint };
export { readCache, writeCache, isCacheValid, deserializeResults, CACHE_VERSION };
