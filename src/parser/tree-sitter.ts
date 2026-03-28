// Low-level tree-sitter wrapper — the only module that imports web-tree-sitter directly.
// Handles WASM initialization, grammar loading, and source parsing.

import { Parser, Language, Query } from 'web-tree-sitter';
import { readFile, access } from 'fs/promises';
import path from 'path';
import { GrammarLoadError } from '../errors.js';
import { debug } from '../logger.js';
import type { LanguageId } from './types.js';

// Singleton parser instance — initialized once per process
let parserInstance: Parser | null = null;
let initPromise: Promise<void> | null = null;

// Cache language objects and queries by languageId
const languageCache = new Map<LanguageId, Language>();
const queryCache = new Map<LanguageId, Query>();

// Resolve a path relative to this file, supporting dev (src/) and dist/ layouts.
// In CJS, __dirname is the directory of the compiled file.
function resolveModulePath(...segments: string[]): string {
  return path.resolve(__dirname, ...segments);
}

// Ordered list of candidate paths for the main WASM runtime file
function wasmCandidates(wasmFilename: string): string[] {
  return [
    // Bundled dist mode — WASM files are copied to dist/ by tsup onSuccess
    resolveModulePath(wasmFilename),
    // Dev mode — resolve through node_modules from project root
    resolveModulePath('..', '..', 'node_modules', 'web-tree-sitter', wasmFilename),
  ];
}

// Ordered list of candidate paths for a grammar WASM file
function grammarWasmCandidates(packageName: string, wasmFilename: string): string[] {
  return [
    // Bundled dist mode — grammar WASMs copied to dist/
    resolveModulePath(wasmFilename),
    // Dev mode — resolve from node_modules
    resolveModulePath('..', '..', 'node_modules', packageName, wasmFilename),
  ];
}

// Ordered list of candidate paths for a query (.scm) file
function queryFileCandidates(packageName: string, queryFile: string): string[] {
  return [
    resolveModulePath('..', '..', 'node_modules', packageName, 'queries', queryFile),
    resolveModulePath('..', 'node_modules', packageName, 'queries', queryFile),
  ];
}

// Map LanguageId to its grammar package name and WASM filename
function grammarInfo(languageId: LanguageId): {
  packageName: string;
  wasmFilename: string;
  queryPackage: string;
} {
  switch (languageId) {
    case 'typescript':
      return {
        packageName: 'tree-sitter-typescript',
        wasmFilename: 'tree-sitter-typescript.wasm',
        queryPackage: 'tree-sitter-typescript',
      };
    case 'tsx':
      return {
        packageName: 'tree-sitter-typescript',
        wasmFilename: 'tree-sitter-tsx.wasm',
        queryPackage: 'tree-sitter-typescript',
      };
    case 'javascript':
      return {
        packageName: 'tree-sitter-javascript',
        wasmFilename: 'tree-sitter-javascript.wasm',
        queryPackage: 'tree-sitter-javascript',
      };
    case 'python':
      return {
        packageName: 'tree-sitter-python',
        wasmFilename: 'tree-sitter-python.wasm',
        queryPackage: 'tree-sitter-python',
      };
  }
}

// Return the first path that exists on disk, or null if none do
async function tryPaths(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    try {
      await access(p);
      return p;
    } catch {
      // Try next candidate
    }
  }
  return null;
}

// Initialize web-tree-sitter WASM runtime — call once at startup.
// Subsequent calls are no-ops (idempotent via cached promise).
export async function initParser(): Promise<void> {
  if (initPromise !== null) {
    return initPromise;
  }
  initPromise = (async (): Promise<void> => {
    const t0 = Date.now();

    const wasmFilename = 'web-tree-sitter.wasm';
    const wasmPath = await tryPaths(wasmCandidates(wasmFilename));

    if (wasmPath === null) {
      throw new GrammarLoadError(
        `Could not find ${wasmFilename}`,
        `Ensure web-tree-sitter is installed: pnpm add web-tree-sitter`,
      );
    }

    await Parser.init({
      locateFile: (_filename: string): string => {
        // web-tree-sitter calls locateFile('tree-sitter.wasm') — return our resolved path
        return wasmPath;
      },
    });

    parserInstance = new Parser();
    debug('web-tree-sitter WASM initialized', { ms: Date.now() - t0, wasmPath });
  })();
  return initPromise;
}

// Load a language grammar by LanguageId — returns cached Language on repeat calls.
export async function loadLanguage(languageId: LanguageId): Promise<Language> {
  const cached = languageCache.get(languageId);
  if (cached !== undefined) {
    return cached;
  }

  await initParser();

  const t0 = Date.now();
  const { packageName, wasmFilename } = grammarInfo(languageId);
  const grammarPath = await tryPaths(grammarWasmCandidates(packageName, wasmFilename));

  if (grammarPath === null) {
    throw new GrammarLoadError(
      `Could not find grammar WASM for ${languageId}: ${wasmFilename}`,
      `Ensure ${packageName} is installed and its WASM file is accessible. Run: pnpm install`,
    );
  }

  const language = await Language.load(grammarPath);
  languageCache.set(languageId, language);
  debug('Grammar loaded', { languageId, ms: Date.now() - t0, grammarPath });

  return language;
}

// Parse source code and return the tree-sitter Tree.
export async function parseSource(source: string, languageId: LanguageId): Promise<import('web-tree-sitter').Tree> {
  await initParser();

  if (parserInstance === null) {
    throw new GrammarLoadError(
      'Parser not initialized',
      'Call initParser() before parseSource()',
    );
  }

  const language = await loadLanguage(languageId);
  parserInstance.setLanguage(language);

  const tree = parserInstance.parse(source);
  if (tree === null) {
    throw new GrammarLoadError(
      `Failed to parse source for language ${languageId}`,
      'Ensure the source is valid and the grammar is correctly loaded.',
    );
  }
  return tree;
}

// Get a compiled Query object for running tag queries against a language — cached per languageId.
export async function createTagQuery(languageId: LanguageId): Promise<Query> {
  const cached = queryCache.get(languageId);
  if (cached !== undefined) {
    return cached;
  }

  const { queryPackage } = grammarInfo(languageId);
  const queryPath = await tryPaths(queryFileCandidates(queryPackage, 'tags.scm'));
  const language = await loadLanguage(languageId);

  if (queryPath === null) {
    // No tags.scm available — extractors will fall back to AST walks
    debug('No tags.scm found, using empty query', { languageId, queryPackage });
    const emptyQuery = new Query(language, '');
    queryCache.set(languageId, emptyQuery);
    return emptyQuery;
  }

  const querySource = await readFile(queryPath, 'utf-8');

  let query: Query;
  try {
    query = new Query(language, querySource);
  } catch (err) {
    // tags.scm may have patterns unsupported by this grammar version — fall back to empty
    debug('Failed to compile tags.scm, using empty query', {
      languageId,
      error: String(err),
    });
    query = new Query(language, '');
  }

  queryCache.set(languageId, query);
  debug('Tag query compiled', { languageId, queryPath });
  return query;
}
