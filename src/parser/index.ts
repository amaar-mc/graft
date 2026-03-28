// Parser orchestrator — dispatches to language-specific extractors.
// All external consumers should import from this module, not from extractor files directly.

import { readFile } from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';
import { initParser } from './tree-sitter.js';
import { extractTypeScriptNodes } from './languages/typescript.js';
import { extractPythonNodes } from './languages/python.js';
import { fileExtensionToLanguage } from './types.js';
import type { ParseResult } from './types.js';
import { ParseError } from '../errors.js';
import { info, debug } from '../logger.js';

// Cache the init promise so we only call initParser() once across all parseFile calls
let parserInitPromise: Promise<void> | null = null;

function ensureParserInitialized(): Promise<void> {
  if (parserInitPromise === null) {
    parserInitPromise = initParser();
  }
  return parserInitPromise;
}

// Parse a single file and return its CodeNode results.
// Returns an empty ParseResult for unsupported file types — never throws for unknown extensions.
export async function parseFile(filePath: string): Promise<ParseResult> {
  const ext = path.extname(filePath);
  const languageId = fileExtensionToLanguage(ext);

  if (languageId === null) {
    debug('Skipping unsupported file extension', { filePath, ext });
    return { filePath, nodes: [], parseTimeMs: 0 };
  }

  await ensureParserInitialized();

  const t0 = performance.now();

  let source: string;
  try {
    source = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new ParseError(
      `Failed to read file: ${filePath}`,
      `Ensure the file exists and is readable. Original error: ${String(err)}`,
    );
  }

  try {
    let nodes: Awaited<ReturnType<typeof extractTypeScriptNodes>>;

    if (languageId === 'python') {
      nodes = await extractPythonNodes(filePath, source);
    } else {
      // 'typescript' | 'tsx' | 'javascript'
      nodes = await extractTypeScriptNodes(filePath, source, languageId);
    }

    const parseTimeMs = performance.now() - t0;
    debug('Parsed file', { filePath, languageId, nodes: nodes.length, parseTimeMs: Math.round(parseTimeMs) });

    return { filePath, nodes, parseTimeMs };
  } catch (err) {
    throw new ParseError(
      `Failed to parse ${languageId} file: ${filePath}`,
      `Check that the file contains valid ${languageId} syntax. Original error: ${String(err)}`,
    );
  }
}

// Parse multiple files concurrently with a bounded concurrency limit.
// Returns all ParseResults sorted by filePath.
export async function parseFiles(filePaths: readonly string[]): Promise<readonly ParseResult[]> {
  const MAX_CONCURRENT = 8;
  const t0 = performance.now();

  const results: ParseResult[] = [];
  const queue = Array.from(filePaths);
  let active = 0;
  let queueIndex = 0;

  await new Promise<void>((resolve, reject) => {
    function startNext(): void {
      while (active < MAX_CONCURRENT && queueIndex < queue.length) {
        const filePath = queue[queueIndex++];
        if (filePath === undefined) {
          break;
        }
        active++;
        parseFile(filePath)
          .then((result) => {
            results.push(result);
            active--;
            if (active === 0 && queueIndex >= queue.length) {
              resolve();
            } else {
              startNext();
            }
          })
          .catch((err: unknown) => {
            reject(err);
          });
      }

      // If no files remain and nothing is active, we're done
      if (active === 0 && queueIndex >= queue.length) {
        resolve();
      }
    }

    startNext();
  });

  const totalNodes = results.reduce((sum, r) => sum + r.nodes.length, 0);
  const totalMs = Math.round(performance.now() - t0);
  info('Parsing complete', {
    files: results.length,
    nodes: totalNodes,
    totalMs,
  });

  results.sort((a, b) => a.filePath.localeCompare(b.filePath));
  return results;
}
