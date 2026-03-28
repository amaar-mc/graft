// Python node extractor.
// Extracts CodeNode objects from Python source files via AST walking and tags.scm queries.

import path from 'path';
import type { Node as TSNode } from 'web-tree-sitter';
import { parseSource, createTagQuery } from '../tree-sitter.js';
import type { CodeNode, NodeKind } from '../types.js';

// Map tags.scm capture names to NodeKind
function captureNameToKind(captureName: string): NodeKind | null {
  switch (captureName) {
    case 'definition.function':
      return 'function';
    case 'definition.method':
      return 'method';
    case 'definition.class':
      return 'class';
    case 'definition.constant':
      return 'constant';
    default:
      return null;
  }
}

// Build a canonical CodeNode id
function makeId(filePath: string, name: string, startLine: number): string {
  return `${filePath}:${name}:${startLine}`;
}

// Extract text from a node
function nodeText(node: TSNode): string {
  return node.text;
}

// Collect all decorator names preceding a definition node.
// In Python tree-sitter, decorators appear as named siblings BEFORE the decorated node.
function collectDecoratorNames(node: TSNode): string[] {
  const decorators: string[] = [];
  let prev = node.previousNamedSibling;
  while (prev !== null && prev.type === 'decorator') {
    // decorator → '@' + (identifier | dotted_name | call)
    // The first named child of decorator is the name or call
    const firstChild = prev.namedChild(0);
    if (firstChild !== null) {
      if (firstChild.type === 'identifier' || firstChild.type === 'dotted_name') {
        decorators.push(nodeText(firstChild));
      } else if (firstChild.type === 'call') {
        const fn = firstChild.namedChild(0);
        if (fn !== null) {
          decorators.push(nodeText(fn));
        }
      }
    }
    prev = prev.previousNamedSibling;
  }
  return decorators;
}

export async function extractPythonNodes(
  filePath: string,
  source: string,
): Promise<readonly CodeNode[]> {
  const tree = await parseSource(source, 'python');
  const rootNode = tree.rootNode;

  const nodesById = new Map<string, CodeNode>();

  function addNode(node: CodeNode): void {
    if (!nodesById.has(node.id)) {
      nodesById.set(node.id, node);
    }
  }

  // --- Phase 1: tags.scm query captures ---
  const query = await createTagQuery('python');
  const captures = query.captures(rootNode);

  // Build map from definition node id → { kind, defNode, nameNode }
  const matchMap = new Map<number, { kind: NodeKind; defNode: TSNode; nameNode: TSNode | null }>();

  for (const capture of captures) {
    const kind = captureNameToKind(capture.name);
    if (kind !== null) {
      const existing = matchMap.get(capture.node.id);
      if (existing === undefined) {
        matchMap.set(capture.node.id, { kind, defNode: capture.node, nameNode: null });
      }
    } else if (capture.name === 'name') {
      const parent = capture.node.parent;
      if (parent !== null) {
        const def = matchMap.get(parent.id);
        if (def !== undefined && def.nameNode === null) {
          def.nameNode = capture.node;
        }
      }
    }
  }

  for (const { kind, defNode, nameNode } of matchMap.values()) {
    if (nameNode === null) {
      continue;
    }
    const name = nodeText(nameNode);
    const startLine = defNode.startPosition.row + 1;
    const endLine = defNode.endPosition.row + 1;
    const decoratorNames = collectDecoratorNames(defNode);
    addNode({
      id: makeId(filePath, name, startLine),
      name,
      kind,
      filePath,
      startLine,
      endLine,
      references: decoratorNames,
    });
  }

  // --- Phase 2: AST walk for constructs not covered by tags.scm ---
  const isInitFile = path.basename(filePath) === '__init__.py';
  walkNode(rootNode, filePath, addNode, false, isInitFile);

  const sorted = Array.from(nodesById.values()).sort((a, b) => a.startLine - b.startLine);
  return sorted;
}

// Determine if a top-level assignment target looks like a constant (SCREAMING_SNAKE_CASE)
function isConstantName(name: string): boolean {
  return name.length > 1 && /^[A-Z_][A-Z0-9_]*$/.test(name);
}

function walkNode(
  node: TSNode,
  filePath: string,
  addNode: (n: CodeNode) => void,
  insideFunction: boolean,
  isInitFile: boolean,
): void {
  switch (node.type) {
    case 'function_definition': {
      const nameNode = node.childForFieldName('name');
      if (nameNode !== null) {
        const name = nodeText(nameNode);
        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        const decorators = collectDecoratorNames(node);
        addNode({
          id: makeId(filePath, name, startLine),
          name,
          kind: 'function',
          filePath,
          startLine,
          endLine,
          references: decorators,
        });
      }
      break;
    }

    case 'class_definition': {
      const nameNode = node.childForFieldName('name');
      if (nameNode !== null) {
        const name = nodeText(nameNode);
        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        const decorators = collectDecoratorNames(node);
        addNode({
          id: makeId(filePath, name, startLine),
          name,
          kind: 'class',
          filePath,
          startLine,
          endLine,
          references: decorators,
        });
      }
      // Still recurse into class body to capture methods
      break;
    }

    case 'import_statement': {
      // import module, import module as alias
      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;
      const importedNames: string[] = [];

      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child === null) {
          continue;
        }
        if (child.type === 'dotted_name') {
          importedNames.push(nodeText(child));
        } else if (child.type === 'aliased_import') {
          const aliasNode = child.childForFieldName('alias');
          const nameNode = child.childForFieldName('name');
          const importName = aliasNode !== null ? nodeText(aliasNode) : nameNode !== null ? nodeText(nameNode) : '';
          if (importName.length > 0) {
            importedNames.push(importName);
          }
        }
      }

      const moduleName = importedNames[0] ?? 'unknown';
      addNode({
        id: makeId(filePath, moduleName, startLine),
        name: moduleName,
        kind: 'import',
        filePath,
        startLine,
        endLine,
        references: importedNames,
      });
      return; // Don't recurse into import nodes
    }

    case 'import_from_statement': {
      // from module import names
      // from .relative import names
      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;

      // Determine module path (may start with dots for relative imports)
      let modulePath = '';
      const moduleNode = node.childForFieldName('module_name');
      // Count leading dots for relative imports
      let leadingDots = '';
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child !== null && child.type === '.') {
          leadingDots += '.';
        }
      }
      if (moduleNode !== null) {
        modulePath = leadingDots + nodeText(moduleNode);
      } else {
        modulePath = leadingDots || 'unknown';
      }

      const importedNames: string[] = [];

      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child === null) {
          continue;
        }
        if (child.type === 'wildcard_import') {
          importedNames.push('*');
        } else if (child.type === 'identifier') {
          importedNames.push(nodeText(child));
        } else if (child.type === 'aliased_import') {
          const aliasNode = child.childForFieldName('alias');
          const nameNode = child.childForFieldName('name');
          const name = aliasNode !== null ? nodeText(aliasNode) : nameNode !== null ? nodeText(nameNode) : '';
          if (name.length > 0) {
            importedNames.push(name);
          }
        }
      }

      // In __init__.py, relative imports act as barrel re-exports
      const isRelative = modulePath.startsWith('.');
      const kind: 'import' | 'export' = isInitFile && isRelative ? 'export' : 'import';

      addNode({
        id: makeId(filePath, modulePath, startLine),
        name: modulePath,
        kind,
        filePath,
        startLine,
        endLine,
        references: importedNames,
      });
      return; // Don't recurse into import nodes
    }

    case 'assignment': {
      // Top-level UPPERCASE = ... → constant
      if (!insideFunction) {
        const targetNode = node.childForFieldName('left');
        if (targetNode !== null && targetNode.type === 'identifier') {
          const name = nodeText(targetNode);
          if (isConstantName(name)) {
            const startLine = node.startPosition.row + 1;
            const endLine = node.endPosition.row + 1;
            addNode({
              id: makeId(filePath, name, startLine),
              name,
              kind: 'constant',
              filePath,
              startLine,
              endLine,
              references: [],
            });
          }
        }
      }
      break;
    }

    default:
      break;
  }

  // Track function scope to avoid emitting nested constants
  const nowInsideFunction =
    insideFunction ||
    node.type === 'function_definition';

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child !== null) {
      walkNode(child, filePath, addNode, nowInsideFunction, isInitFile);
    }
  }
}
