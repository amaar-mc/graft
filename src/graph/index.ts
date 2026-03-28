// Graph builder: converts ParseResult[] from Phase 1 into a directed FileGraph.
// Each file becomes a node; import/export references become directed edges.
// Unresolved imports (npm packages, missing files) are silently dropped.

import * as path from 'node:path';
import type { ParseResult } from '../parser/types.js';
import type { FileGraph } from './types.js';

// Extensions tried in order when an import path has no extension and the bare path
// is not in the known files set. Index variants are tried after all extension variants.
const RESOLUTION_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.py'] as const;

// Attempt to resolve an import reference to an absolute file path in the known files set.
// Returns null if the reference cannot be resolved (npm package, missing file, etc.).
function resolveImportPath(
  importerFilePath: string,
  ref: string,
  knownFiles: ReadonlySet<string>,
): string | null {
  // Python relative imports start with one or more dots followed by the module path.
  // Example: ".models" = same package, "..core" = parent package.
  const pythonRelativeMatch = /^(\.{2,})(.*)$/.exec(ref);
  const singleDotMatch = /^\.([\w].*)$/.exec(ref);

  if (pythonRelativeMatch !== null) {
    // Multi-dot Python relative import: count dots, walk up that many levels.
    const dots = pythonRelativeMatch[1]!;
    const moduleName = pythonRelativeMatch[2] ?? '';
    return resolvePythonRelative(importerFilePath, dots.length, moduleName, knownFiles);
  }

  if (singleDotMatch !== null) {
    // Single-dot Python relative import: same directory as importer.
    const moduleName = singleDotMatch[1]!;
    return resolvePythonRelative(importerFilePath, 1, moduleName, knownFiles);
  }

  // Standard relative imports start with ./ or ../
  if (!ref.startsWith('./') && !ref.startsWith('../')) {
    // Not a relative import — npm package, builtin, or absolute. Drop it.
    return null;
  }

  const importerDir = path.dirname(importerFilePath);
  const resolved = path.resolve(importerDir, ref);

  return resolveWithExtensions(resolved, knownFiles);
}

// Resolve a Python relative import by navigating up `dots` directories from the importer.
// moduleName is the dotted module path after the leading dots (e.g., "models" in ".models").
// The module name is converted to a file path by replacing dots with path separators.
function resolvePythonRelative(
  importerFilePath: string,
  dots: number,
  moduleName: string,
  knownFiles: ReadonlySet<string>,
): string | null {
  let baseDir = path.dirname(importerFilePath);

  // Navigate up (dots - 1) levels. One dot = same directory (no navigation up).
  for (let i = 1; i < dots; i++) {
    baseDir = path.dirname(baseDir);
  }

  if (moduleName === '') {
    // Bare package import (e.g., "from . import something") — resolve to __init__.py.
    const initPath = path.join(baseDir, '__init__.py');
    return knownFiles.has(initPath) ? initPath : null;
  }

  // Convert dotted module name to path (e.g., "api.models" -> "api/models").
  const modulePath = moduleName.replace(/\./g, '/');
  const resolved = path.join(baseDir, modulePath);

  return resolveWithExtensions(resolved, knownFiles);
}

// Try to match a resolved (extension-stripped) path against the known files set.
// Tries the bare path, then each extension, then index file variants.
function resolveWithExtensions(
  resolvedBase: string,
  knownFiles: ReadonlySet<string>,
): string | null {
  // Bare path might already have an extension and be directly in the files set.
  if (knownFiles.has(resolvedBase)) {
    return resolvedBase;
  }

  // Try appending known extensions.
  for (const ext of RESOLUTION_EXTENSIONS) {
    const candidate = resolvedBase + ext;
    if (knownFiles.has(candidate)) {
      return candidate;
    }
  }

  // Try index file variants (e.g., ./foo -> ./foo/index.ts).
  for (const ext of RESOLUTION_EXTENSIONS) {
    const candidate = path.join(resolvedBase, `index${ext}`);
    if (knownFiles.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

// Convert Phase 1 ParseResult[] into a directed FileGraph with bidirectional edges.
// Only import and export kind nodes produce edges; other nodes populate definitions.
// Unresolvable references (npm packages, missing files) are silently dropped.
function buildGraph(results: readonly ParseResult[]): FileGraph {
  const files = new Set<string>();
  // Use mutable Sets internally; cast to ReadonlySet<string> at return time.
  const forwardEdges = new Map<string, Set<string>>();
  const reverseEdges = new Map<string, Set<string>>();
  const definitions = new Map<string, readonly ParseResult['nodes'][number][]>();

  // First pass: index all files and initialize edge sets.
  for (const result of results) {
    files.add(result.filePath);
    forwardEdges.set(result.filePath, new Set<string>());
    reverseEdges.set(result.filePath, new Set<string>());
    definitions.set(result.filePath, result.nodes);
  }

  const knownFiles: ReadonlySet<string> = files;

  // Second pass: resolve import/export references and build edges.
  // Parsers store the module path in node.name for import/export nodes.
  // node.references holds the imported/exported identifiers (not the module path).
  for (const result of results) {
    for (const node of result.nodes) {
      // Only import and export nodes carry dependency references.
      if (node.kind !== 'import' && node.kind !== 'export') {
        continue;
      }

      // The module path is always in node.name for import/export nodes.
      const resolved = resolveImportPath(result.filePath, node.name, knownFiles);
      if (resolved === null) {
        continue;
      }

      // Guard: resolved target must be in the known files set (should always be true
      // given resolveImportPath returns null otherwise, but be defensive).
      if (!knownFiles.has(resolved)) {
        continue;
      }

      // Set deduplication handles duplicate imports automatically.
      forwardEdges.get(result.filePath)!.add(resolved);
      reverseEdges.get(resolved)!.add(result.filePath);
    }
  }

  return {
    files,
    forwardEdges: forwardEdges as ReadonlyMap<string, ReadonlySet<string>>,
    reverseEdges: reverseEdges as ReadonlyMap<string, ReadonlySet<string>>,
    definitions,
  };
}

export { buildGraph };
