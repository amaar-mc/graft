// TypeScript/JavaScript/TSX node extractor.
// Extracts CodeNode objects from TS/JS/TSX source files via AST walking and tags.scm queries.

import type { Node as TSNode } from 'web-tree-sitter';
import { parseSource, createTagQuery } from '../tree-sitter.js';
import type { CodeNode, LanguageId, NodeKind } from '../types.js';

// Map tags.scm capture names to NodeKind
function captureNameToKind(captureName: string): NodeKind | null {
  switch (captureName) {
    case 'definition.function':
      return 'function';
    case 'definition.method':
      return 'method';
    case 'definition.class':
      return 'class';
    case 'definition.interface':
      return 'interface';
    case 'definition.module':
      return 'module';
    case 'definition.type':
      return 'type';
    case 'definition.enum':
      return 'enum';
    case 'definition.constant':
      return 'constant';
    default:
      return null;
  }
}

// Build a CodeNode id in the canonical format
function makeId(filePath: string, name: string, startLine: number): string {
  return `${filePath}:${name}:${startLine}`;
}

// Collect text of an identifier or type_identifier node
function nodeText(node: TSNode): string {
  return node.text;
}

// Walk a node's children collecting all identifier texts used in expressions
function collectReferences(node: TSNode, collected: Set<string>): void {
  if (node.type === 'identifier' || node.type === 'property_identifier' || node.type === 'type_identifier') {
    const name = node.text;
    if (name.length > 0) {
      collected.add(name);
    }
  }
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child !== null) {
      collectReferences(child, collected);
    }
  }
}

// Collect decorator names that appear immediately before a class/function node.
// Decorators in tree-sitter TS appear as siblings preceding the declaration.
function collectDecoratorNames(node: TSNode): string[] {
  const decorators: string[] = [];
  let prev = node.previousNamedSibling;
  while (prev !== null && prev.type === 'decorator') {
    // decorator → '@' + identifier or call_expression
    const firstChild = prev.child(1); // child(0) is '@'
    if (firstChild !== null) {
      if (firstChild.type === 'identifier') {
        decorators.push(nodeText(firstChild));
      } else if (firstChild.type === 'call_expression') {
        const fn = firstChild.child(0);
        if (fn !== null) {
          decorators.push(nodeText(fn));
        }
      }
    }
    prev = prev.previousNamedSibling;
  }
  return decorators;
}

// Extract a name from a node's named child with a given field name
function fieldName(node: TSNode, field: string): string | null {
  const child = node.childForFieldName(field);
  return child !== null ? nodeText(child) : null;
}

export async function extractTypeScriptNodes(
  filePath: string,
  source: string,
  languageId: LanguageId,
): Promise<readonly CodeNode[]> {
  const tree = await parseSource(source, languageId);
  const rootNode = tree.rootNode;

  const nodesById = new Map<string, CodeNode>();

  // Helper to add a node, deduplicating by id
  function addNode(node: CodeNode): void {
    if (!nodesById.has(node.id)) {
      nodesById.set(node.id, node);
    }
  }

  // --- Phase 1: tags.scm query captures ---
  const query = await createTagQuery(languageId);
  const captures = query.captures(rootNode);

  // Group captures: definition captures come in pairs with @name captures
  // Each match has a definition node and an associated name node
  const matchMap = new Map<number, { kind: NodeKind; defNode: TSNode; nameNode: TSNode | null }>();

  for (const capture of captures) {
    const kind = captureNameToKind(capture.name);
    if (kind !== null) {
      const existing = matchMap.get(capture.node.id);
      if (existing === undefined) {
        matchMap.set(capture.node.id, { kind, defNode: capture.node, nameNode: null });
      }
    } else if (capture.name === 'name') {
      // Find the closest definition capture that owns this name
      // In web-tree-sitter, captures may not have an explicit match index,
      // so we match by parent node ID
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
    const startLine = defNode.startPosition.row + 1; // tree-sitter is 0-indexed
    const endLine = defNode.endPosition.row + 1;
    const decoratorNames = collectDecoratorNames(defNode);
    const refs = new Set<string>(decoratorNames);
    addNode({
      id: makeId(filePath, name, startLine),
      name,
      kind,
      filePath,
      startLine,
      endLine,
      references: Array.from(refs),
    });
  }

  // --- Phase 2: AST walk for constructs not covered by tags.scm ---
  walkNode(rootNode, filePath, addNode, false);

  // Sort by startLine and return
  const sorted = Array.from(nodesById.values()).sort((a, b) => a.startLine - b.startLine);
  return sorted;
}

// Recursively walk the AST and emit CodeNodes for each relevant construct
function walkNode(
  node: TSNode,
  filePath: string,
  addNode: (n: CodeNode) => void,
  insideFunction: boolean,
): void {
  switch (node.type) {
    case 'function_declaration':
    case 'function':
    case 'generator_function_declaration': {
      const nameNode = node.childForFieldName('name');
      if (nameNode !== null) {
        const name = nodeText(nameNode);
        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        const decorators = collectDecoratorNames(node);
        const refs = new Set<string>(decorators);
        addNode({
          id: makeId(filePath, name, startLine),
          name,
          kind: 'function',
          filePath,
          startLine,
          endLine,
          references: Array.from(refs),
        });
      }
      break;
    }

    case 'arrow_function': {
      // Arrow functions assigned to variables: const foo = () => {}
      // Handled via lexical_declaration below; skip here to avoid duplicates
      break;
    }

    case 'class_declaration':
    case 'abstract_class_declaration': {
      const nameNode = node.childForFieldName('name');
      if (nameNode !== null) {
        const name = nodeText(nameNode);
        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        const decorators = collectDecoratorNames(node);
        const refs = new Set<string>(decorators);
        // Collect superclass references
        const superclassNode = node.childForFieldName('superclass');
        if (superclassNode !== null) {
          refs.add(nodeText(superclassNode));
        }
        addNode({
          id: makeId(filePath, name, startLine),
          name,
          kind: 'class',
          filePath,
          startLine,
          endLine,
          references: Array.from(refs),
        });
      }
      break;
    }

    case 'method_definition': {
      const nameNode = node.childForFieldName('name');
      if (nameNode !== null) {
        const name = nodeText(nameNode);
        // Skip constructor as a separate method node (it belongs to the class)
        if (name !== 'constructor') {
          const startLine = node.startPosition.row + 1;
          const endLine = node.endPosition.row + 1;
          const decorators = collectDecoratorNames(node);
          addNode({
            id: makeId(filePath, name, startLine),
            name,
            kind: 'method',
            filePath,
            startLine,
            endLine,
            references: Array.from(decorators),
          });
        }
      }
      break;
    }

    case 'interface_declaration': {
      const nameNode = node.childForFieldName('name');
      if (nameNode !== null) {
        const name = nodeText(nameNode);
        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        addNode({
          id: makeId(filePath, name, startLine),
          name,
          kind: 'interface',
          filePath,
          startLine,
          endLine,
          references: [],
        });
      }
      break;
    }

    case 'type_alias_declaration': {
      const nameNode = node.childForFieldName('name');
      if (nameNode !== null) {
        const name = nodeText(nameNode);
        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        // Collect referenced types from the type value
        const valueNode = node.childForFieldName('value');
        const refs = new Set<string>();
        if (valueNode !== null) {
          collectReferences(valueNode, refs);
        }
        addNode({
          id: makeId(filePath, name, startLine),
          name,
          kind: 'type',
          filePath,
          startLine,
          endLine,
          references: Array.from(refs),
        });
      }
      break;
    }

    case 'enum_declaration': {
      const nameNode = node.childForFieldName('name');
      if (nameNode !== null) {
        const name = nodeText(nameNode);
        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        addNode({
          id: makeId(filePath, name, startLine),
          name,
          kind: 'enum',
          filePath,
          startLine,
          endLine,
          references: [],
        });
      }
      break;
    }

    case 'lexical_declaration':
    case 'variable_declaration': {
      // const/let/var declarations — may be arrow functions or other values
      if (!insideFunction) {
        for (let i = 0; i < node.namedChildCount; i++) {
          const declarator = node.namedChild(i);
          if (declarator === null || declarator.type !== 'variable_declarator') {
            continue;
          }
          const nameNode = declarator.childForFieldName('name');
          const valueNode = declarator.childForFieldName('value');
          if (nameNode === null) {
            continue;
          }
          const name = nodeText(nameNode);
          const startLine = node.startPosition.row + 1;
          const endLine = node.endPosition.row + 1;

          if (
            valueNode !== null &&
            (valueNode.type === 'arrow_function' || valueNode.type === 'function')
          ) {
            // Top-level function variable
            addNode({
              id: makeId(filePath, name, startLine),
              name,
              kind: 'function',
              filePath,
              startLine,
              endLine,
              references: [],
            });
          } else if (name === name.toUpperCase() && name.length > 1 && /^[A-Z_][A-Z0-9_]*$/.test(name)) {
            // SCREAMING_SNAKE_CASE top-level constant
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

    case 'import_statement': {
      // import { foo, bar } from './module'
      // import * as ns from './module'
      // import defaultExport from './module'
      const sourceNode = node.childForFieldName('source');
      const modulePath = sourceNode !== null ? nodeText(sourceNode).replace(/['"]/g, '') : '';
      const importedNames: string[] = [];

      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child === null) {
          continue;
        }
        if (child.type === 'import_clause') {
          // Default import and/or named imports
          for (let j = 0; j < child.namedChildCount; j++) {
            const importChild = child.namedChild(j);
            if (importChild === null) {
              continue;
            }
            if (importChild.type === 'identifier') {
              importedNames.push(nodeText(importChild));
            } else if (importChild.type === 'named_imports') {
              for (let k = 0; k < importChild.namedChildCount; k++) {
                const specifier = importChild.namedChild(k);
                if (specifier !== null && specifier.type === 'import_specifier') {
                  const localName = specifier.childForFieldName('alias') ?? specifier.childForFieldName('name');
                  if (localName !== null) {
                    importedNames.push(nodeText(localName));
                  }
                }
              }
            } else if (importChild.type === 'namespace_import') {
              const nsName = importChild.namedChild(0);
              if (nsName !== null) {
                importedNames.push(nodeText(nsName));
              }
            }
          }
        }
      }

      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;
      addNode({
        id: makeId(filePath, modulePath, startLine),
        name: modulePath,
        kind: 'import',
        filePath,
        startLine,
        endLine,
        references: importedNames,
      });
      break;
    }

    case 'export_statement': {
      // Barrel re-exports: export { foo } from '...' or export * from '...'
      const sourceNode = node.childForFieldName('source');
      if (sourceNode !== null) {
        // This is a re-export from another module
        const modulePath = nodeText(sourceNode).replace(/['"]/g, '');
        const exportedNames: string[] = [];

        // export * from '...' → no named exports
        // export { foo, bar } from '...'
        for (let i = 0; i < node.namedChildCount; i++) {
          const child = node.namedChild(i);
          if (child === null) {
            continue;
          }
          if (child.type === 'export_clause') {
            for (let j = 0; j < child.namedChildCount; j++) {
              const specifier = child.namedChild(j);
              if (specifier !== null && specifier.type === 'export_specifier') {
                const localName = specifier.childForFieldName('name');
                if (localName !== null) {
                  exportedNames.push(nodeText(localName));
                }
              }
            }
          }
        }

        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        addNode({
          id: makeId(filePath, modulePath, startLine),
          name: modulePath,
          kind: 'export',
          filePath,
          startLine,
          endLine,
          references: exportedNames.length > 0 ? exportedNames : [modulePath],
        });
        // Don't recurse into export_statement children to avoid double-processing
        return;
      }
      break;
    }

    default:
      break;
  }

  // Determine if we're now inside a function scope
  const nowInsideFunction =
    insideFunction ||
    node.type === 'function_declaration' ||
    node.type === 'function' ||
    node.type === 'arrow_function' ||
    node.type === 'method_definition' ||
    node.type === 'generator_function_declaration';

  // Recurse into children
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child !== null) {
      walkNode(child, filePath, addNode, nowInsideFunction);
    }
  }
}

// Export fieldName for use in other extractors if needed
export { fieldName };
