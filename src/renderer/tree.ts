// Token-budgeted hierarchical tree renderer for FileGraph.
// Produces a sorted-by-score text tree that stays within a configurable token budget.
// Primary output format for the CLI and MCP context window.

import path from 'path';
import type { FileGraph, TreeRendererOptions } from '../graph/types.js';
import type { NodeKind } from '../parser/types.js';

// Kinds excluded from rendered output — structural noise, not semantic signal.
const EXCLUDED_KINDS: ReadonlySet<NodeKind> = new Set(['import', 'export']);

// Render a token-budgeted, score-sorted text tree of the file graph.
// Files are ranked descending by score; files that would push the output
// over charBudget are excluded entirely (no partial blocks).
// Footer format: "[~N tokens]"
function renderTree(
  graph: FileGraph,
  scores: ReadonlyMap<string, number>,
  rootDir: string,
  options: TreeRendererOptions,
): string {
  const charBudget = options.tokenBudget * options.charsPerToken;

  // Sort all files by score descending; files with no score go last at 0.
  const sortedFiles = Array.from(graph.files).sort((a, b) => {
    const scoreA = scores.get(a) ?? 0;
    const scoreB = scores.get(b) ?? 0;
    return scoreB - scoreA;
  });

  const blocks: string[] = [];
  let totalChars = 0;

  for (const filePath of sortedFiles) {
    const score = scores.get(filePath) ?? 0;
    const relativePath = path.relative(rootDir, filePath);

    // Build header line
    const header = `${relativePath} [score: ${score.toFixed(4)}]`;

    // Build definition lines (excluding import/export kinds)
    const defs = graph.definitions.get(filePath) ?? [];
    const defLines = defs
      .filter((d) => !EXCLUDED_KINDS.has(d.kind))
      .map((d) => `  ${d.kind} ${d.name} (L${d.startLine})`);

    // Assemble the block: header + defs + trailing newline
    const blockLines = [header, ...defLines, ''];
    const block = blockLines.join('\n');

    // Enforce budget: exclude entire block if it would overflow
    if (totalChars + block.length > charBudget) {
      break;
    }

    blocks.push(block);
    totalChars += block.length;
  }

  const tokenCount = Math.ceil(totalChars / options.charsPerToken);
  const footer = `[~${tokenCount} tokens]`;

  if (blocks.length === 0) {
    return footer;
  }

  // Join all blocks; each block already ends with \n, so trim trailing and add footer on new line.
  const body = blocks.join('').trimEnd();
  return `${body}\n${footer}`;
}

export { renderTree };
