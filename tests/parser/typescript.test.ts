import { describe, it, expect } from 'vitest';
import path from 'path';
import { parseFile } from '../../src/parser/index';
import type { CodeNode } from '../../src/parser/types';

const FIXTURES = path.resolve(__dirname, '../fixtures/typescript');
const BASIC_TS = path.join(FIXTURES, 'basic.ts');
const BARREL_TS = path.join(FIXTURES, 'barrel.ts');
const REACT_TSX = path.join(FIXTURES, 'react.tsx');

// Helper to find a node by name and optionally kind
function findNode(nodes: readonly CodeNode[], name: string, kind?: CodeNode['kind']): CodeNode | undefined {
  return nodes.find((n) => n.name === name && (kind === undefined || n.kind === kind));
}

describe('TypeScript parser — extracts definitions (PARSE-01)', () => {
  it('extracts top-level function', async () => {
    const result = await parseFile(BASIC_TS);
    const node = findNode(result.nodes, 'greet', 'function');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('function');
  });

  it('extracts interface', async () => {
    const result = await parseFile(BASIC_TS);
    const node = findNode(result.nodes, 'User', 'interface');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('interface');
  });

  it('extracts class', async () => {
    const result = await parseFile(BASIC_TS);
    const node = findNode(result.nodes, 'UserService', 'class');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('class');
  });

  it('extracts class method', async () => {
    const result = await parseFile(BASIC_TS);
    const node = findNode(result.nodes, 'getUser', 'method');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('method');
  });

  it('extracts type alias', async () => {
    const result = await parseFile(BASIC_TS);
    const node = findNode(result.nodes, 'UserId', 'type');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('type');
  });

  it('extracts enum', async () => {
    const result = await parseFile(BASIC_TS);
    const node = findNode(result.nodes, 'Role', 'enum');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('enum');
  });

  it('extracts top-level constant', async () => {
    const result = await parseFile(BASIC_TS);
    const node = findNode(result.nodes, 'MAX_USERS', 'constant');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('constant');
  });
});

describe('TypeScript parser — extracts references (PARSE-02)', () => {
  it('extracts import reference from basic.ts', async () => {
    const result = await parseFile(BASIC_TS);
    const importNode = result.nodes.find((n) => n.kind === 'import');
    expect(importNode).toBeDefined();
    // The import is from './other'
    expect(importNode?.name).toBe('./other');
  });

  it('import node references the imported names', async () => {
    const result = await parseFile(BASIC_TS);
    const importNode = result.nodes.find((n) => n.kind === 'import' && n.name === './other');
    expect(importNode).toBeDefined();
    expect(importNode?.references).toContain('UserId');
  });
});

describe('TypeScript specific constructs (PARSE-04)', () => {
  it('extracts barrel re-export with named exports', async () => {
    const result = await parseFile(BARREL_TS);
    const exportNode = result.nodes.find((n) => n.kind === 'export' && n.name === './basic');
    expect(exportNode).toBeDefined();
    expect(exportNode?.references).toContain('User');
    expect(exportNode?.references).toContain('UserService');
  });

  it('extracts barrel re-export with wildcard', async () => {
    const result = await parseFile(BARREL_TS);
    const exportNode = result.nodes.find((n) => n.kind === 'export' && n.name === './react');
    expect(exportNode).toBeDefined();
  });

  it('extracts type re-export from barrel', async () => {
    const result = await parseFile(BARREL_TS);
    // type re-exports show up as 'export' kind with the source module as name
    const exportNodes = result.nodes.filter((n) => n.kind === 'export');
    expect(exportNodes.length).toBeGreaterThan(0);
  });
});

describe('TSX support (PARSE-04)', () => {
  it('extracts Dashboard function component from react.tsx', async () => {
    const result = await parseFile(REACT_TSX);
    const node = findNode(result.nodes, 'Dashboard', 'function');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('function');
  });

  it('extracts DashboardProps interface from react.tsx', async () => {
    const result = await parseFile(REACT_TSX);
    const node = findNode(result.nodes, 'DashboardProps', 'interface');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('interface');
  });

  it('extracts React import from react.tsx', async () => {
    const result = await parseFile(REACT_TSX);
    const importNode = result.nodes.find((n) => n.kind === 'import' && n.name === 'react');
    expect(importNode).toBeDefined();
  });
});

describe('TypeScript parser — CodeNode shape (PARSE-06)', () => {
  it('all nodes have correct id format: filePath:name:startLine', async () => {
    const result = await parseFile(BASIC_TS);
    for (const node of result.nodes) {
      const expectedId = `${BASIC_TS}:${node.name}:${node.startLine}`;
      expect(node.id).toBe(expectedId);
    }
  });

  it('all nodes have non-empty name and kind', async () => {
    const result = await parseFile(BASIC_TS);
    for (const node of result.nodes) {
      expect(node.name.length).toBeGreaterThan(0);
      expect(node.kind.length).toBeGreaterThan(0);
    }
  });

  it('all nodes have startLine <= endLine', async () => {
    const result = await parseFile(BASIC_TS);
    for (const node of result.nodes) {
      expect(node.startLine).toBeLessThanOrEqual(node.endLine);
    }
  });

  it('all nodes have absolute filePath', async () => {
    const result = await parseFile(BASIC_TS);
    for (const node of result.nodes) {
      expect(path.isAbsolute(node.filePath)).toBe(true);
    }
  });

  it('ParseResult contains filePath and parseTimeMs', async () => {
    const result = await parseFile(BASIC_TS);
    expect(result.filePath).toBe(BASIC_TS);
    expect(typeof result.parseTimeMs).toBe('number');
    expect(result.parseTimeMs).toBeGreaterThanOrEqual(0);
  });
});
