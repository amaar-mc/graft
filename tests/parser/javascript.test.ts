import { describe, it, expect } from 'vitest';
import path from 'path';
import { parseFile } from '../../src/parser/index';
import type { CodeNode } from '../../src/parser/types';

const FIXTURES = path.resolve(__dirname, '../fixtures/javascript');
const BASIC_JS = path.join(FIXTURES, 'basic.js');

function findNode(nodes: readonly CodeNode[], name: string, kind?: CodeNode['kind']): CodeNode | undefined {
  return nodes.find((n) => n.name === name && (kind === undefined || n.kind === kind));
}

describe('JavaScript parser — extracts definitions (PARSE-01)', () => {
  it('extracts top-level function', async () => {
    const result = await parseFile(BASIC_JS);
    const node = findNode(result.nodes, 'fetchData', 'function');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('function');
  });

  it('extracts class', async () => {
    const result = await parseFile(BASIC_JS);
    const node = findNode(result.nodes, 'DataService', 'class');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('class');
  });

  it('extracts class method', async () => {
    const result = await parseFile(BASIC_JS);
    const node = findNode(result.nodes, 'getData', 'method');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('method');
  });

  it('extracts top-level constant (MAX_RETRIES)', async () => {
    const result = await parseFile(BASIC_JS);
    const node = findNode(result.nodes, 'MAX_RETRIES', 'constant');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('constant');
  });
});

describe('JavaScript parser — extracts references (PARSE-02)', () => {
  it('extracts import reference', async () => {
    const result = await parseFile(BASIC_JS);
    const importNode = result.nodes.find((n) => n.kind === 'import');
    expect(importNode).toBeDefined();
    expect(importNode?.name).toBe('fs');
  });

  it('import node references the imported names', async () => {
    const result = await parseFile(BASIC_JS);
    const importNode = result.nodes.find((n) => n.kind === 'import' && n.name === 'fs');
    expect(importNode).toBeDefined();
    expect(importNode?.references).toContain('readFileSync');
  });
});

describe('JavaScript parser — CodeNode shape (PARSE-06)', () => {
  it('all nodes have correct id format: filePath:name:startLine', async () => {
    const result = await parseFile(BASIC_JS);
    for (const node of result.nodes) {
      const expectedId = `${BASIC_JS}:${node.name}:${node.startLine}`;
      expect(node.id).toBe(expectedId);
    }
  });

  it('all nodes have startLine <= endLine', async () => {
    const result = await parseFile(BASIC_JS);
    for (const node of result.nodes) {
      expect(node.startLine).toBeLessThanOrEqual(node.endLine);
    }
  });

  it('all nodes have absolute filePath', async () => {
    const result = await parseFile(BASIC_JS);
    for (const node of result.nodes) {
      expect(path.isAbsolute(node.filePath)).toBe(true);
    }
  });

  it('ParseResult filePath matches requested path', async () => {
    const result = await parseFile(BASIC_JS);
    expect(result.filePath).toBe(BASIC_JS);
  });
});
