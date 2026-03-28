// Core type contract for the parsing pipeline.
// All parsers produce CodeNode objects; all consumers (graph, renderer) depend on this seam.

type NodeKind =
  | 'function'
  | 'method'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'module'
  | 'constant'
  | 'import'
  | 'export'
  | 'decorator'
  | 'variable';

interface CodeNode {
  // Format: `${filePath}:${name}:${startLine}` — unique within a parse session
  readonly id: string;
  readonly name: string;
  readonly kind: NodeKind;
  // Absolute path to the source file
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  // Names this node references (imports, calls, type usages)
  readonly references: readonly string[];
}

interface ParseResult {
  readonly filePath: string;
  readonly nodes: readonly CodeNode[];
  readonly parseTimeMs: number;
}

type LanguageId = 'typescript' | 'tsx' | 'javascript' | 'python';

function fileExtensionToLanguage(ext: string): LanguageId | null {
  switch (ext) {
    case '.ts':
      return 'typescript';
    case '.tsx':
      return 'tsx';
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.py':
      return 'python';
    default:
      return null;
  }
}

export type { NodeKind, CodeNode, ParseResult, LanguageId };
export { fileExtensionToLanguage };
