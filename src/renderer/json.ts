// JSON map renderer for FileGraph — structured output for programmatic consumers.
// Produces a score-sorted JSON document with graph structure, scores, and metadata.

import path from 'path';
import type {
  FileGraph,
  JsonRendererOptions,
} from '../graph/types.js';
import type { NodeKind } from '../parser/types.js';

// Kinds excluded from rendered output — import/export are structural noise.
const EXCLUDED_KINDS: ReadonlySet<NodeKind> = new Set(['import', 'export']);

interface DefinitionEntry {
  readonly name: string;
  readonly kind: NodeKind;
  readonly startLine: number;
  readonly endLine: number;
}

interface FileEntry {
  readonly filePath: string;
  readonly score: number;
  readonly definitions: readonly DefinitionEntry[];
}

interface JsonOutput {
  readonly metadata: {
    readonly fileCount: number;
    readonly edgeCount: number;
    readonly tokenCount: number;
    readonly rootDir: string;
  };
  readonly files: readonly FileEntry[];
}

// Render a JSON representation of the file graph sorted by score descending.
// filePaths in output are relative to rootDir.
// tokenCount = Math.ceil(JSON.stringify(output).length / 3).
function renderJson(
  graph: FileGraph,
  scores: ReadonlyMap<string, number>,
  rootDir: string,
  _options: JsonRendererOptions,
): string {
  // Sort files by score descending; files with no score go last at 0.
  const sortedFiles = Array.from(graph.files).sort((a, b) => {
    const scoreA = scores.get(a) ?? 0;
    const scoreB = scores.get(b) ?? 0;
    return scoreB - scoreA;
  });

  const fileEntries: FileEntry[] = sortedFiles.map((filePath) => {
    const score = scores.get(filePath) ?? 0;
    const relativePath = path.relative(rootDir, filePath);
    const defs = graph.definitions.get(filePath) ?? [];

    const definitions: DefinitionEntry[] = defs
      .filter((d) => !EXCLUDED_KINDS.has(d.kind))
      .map((d) => ({
        name: d.name,
        kind: d.kind,
        startLine: d.startLine,
        endLine: d.endLine,
      }));

    return {
      filePath: relativePath,
      score,
      definitions,
    };
  });

  // edgeCount = sum of all forwardEdge set sizes
  let edgeCount = 0;
  for (const edgeSet of graph.forwardEdges.values()) {
    edgeCount += edgeSet.size;
  }

  // Compute token count from the serialized output length
  const preliminaryOutput: JsonOutput = {
    metadata: {
      fileCount: graph.files.size,
      edgeCount,
      tokenCount: 0, // placeholder — replaced below
      rootDir,
    },
    files: fileEntries,
  };

  const serialized = JSON.stringify(preliminaryOutput, null, 2);
  const tokenCount = Math.ceil(serialized.length / 3);

  // Replace tokenCount placeholder with the real value
  const finalOutput: JsonOutput = {
    metadata: {
      fileCount: graph.files.size,
      edgeCount,
      tokenCount,
      rootDir,
    },
    files: fileEntries,
  };

  return JSON.stringify(finalOutput, null, 2);
}

export { renderJson };
