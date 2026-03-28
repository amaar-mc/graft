import { describe, it, expect } from 'vitest';
import path from 'path';
import { parseFile } from '../../src/parser/index';
import type { CodeNode } from '../../src/parser/types';

const FIXTURES = path.resolve(__dirname, '../fixtures/python');
const BASIC_PY = path.join(FIXTURES, 'basic.py');
const CLASSES_PY = path.join(FIXTURES, 'classes.py');
const IMPORTS_PY = path.join(FIXTURES, 'imports.py');

function findNode(nodes: readonly CodeNode[], name: string, kind?: CodeNode['kind']): CodeNode | undefined {
  return nodes.find((n) => n.name === name && (kind === undefined || n.kind === kind));
}

describe('Python parser — extracts definitions (PARSE-03)', () => {
  it('extracts top-level function', async () => {
    const result = await parseFile(BASIC_PY);
    const node = findNode(result.nodes, 'greet', 'function');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('function');
  });

  it('extracts class', async () => {
    const result = await parseFile(BASIC_PY);
    const node = findNode(result.nodes, 'UserService', 'class');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('class');
  });

  it('extracts class method', async () => {
    const result = await parseFile(BASIC_PY);
    const node = findNode(result.nodes, 'get_user', 'method');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('method');
  });

  it('extracts top-level constant (MAX_USERS)', async () => {
    const result = await parseFile(BASIC_PY);
    const node = findNode(result.nodes, 'MAX_USERS', 'constant');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('constant');
  });
});

describe('Python parser — extracts references (PARSE-03)', () => {
  it('extracts from-import reference (from os import path)', async () => {
    const result = await parseFile(BASIC_PY);
    const importNode = result.nodes.find((n) => n.kind === 'import' && n.name === 'os');
    expect(importNode).toBeDefined();
    expect(importNode?.references).toContain('path');
  });

  it('extracts plain import (import json)', async () => {
    const result = await parseFile(BASIC_PY);
    const importNode = result.nodes.find((n) => n.kind === 'import' && n.name === 'json');
    expect(importNode).toBeDefined();
  });
});

describe('Python specific constructs (PARSE-05)', () => {
  it('extracts dataclass (Config) with @dataclass decorator', async () => {
    const result = await parseFile(CLASSES_PY);
    const node = findNode(result.nodes, 'Config', 'class');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('class');
    // Decorator name should appear in references
    expect(node?.references).toContain('dataclass');
  });

  it('extracts decorated function (compute) with @cache decorator', async () => {
    const result = await parseFile(CLASSES_PY);
    const node = findNode(result.nodes, 'compute', 'function');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('function');
    expect(node?.references).toContain('cache');
  });

  it('extracts undecorated class (Repository)', async () => {
    const result = await parseFile(CLASSES_PY);
    const node = findNode(result.nodes, 'Repository', 'class');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('class');
  });

  it('extracts methods from decorated class (connection_string)', async () => {
    const result = await parseFile(CLASSES_PY);
    const node = findNode(result.nodes, 'connection_string', 'method');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('method');
  });

  it('extracts relative import (from . import utils)', async () => {
    const result = await parseFile(IMPORTS_PY);
    const importNode = result.nodes.find((n) => n.kind === 'import' && n.name === '.');
    expect(importNode).toBeDefined();
    expect(importNode?.references).toContain('utils');
  });

  it('extracts relative import from parent (from ..core import base)', async () => {
    const result = await parseFile(IMPORTS_PY);
    const importNode = result.nodes.find((n) => n.kind === 'import' && n.name === '..core');
    expect(importNode).toBeDefined();
    expect(importNode?.references).toContain('base');
  });

  it('extracts relative import with module (from .models import User)', async () => {
    const result = await parseFile(IMPORTS_PY);
    const importNode = result.nodes.find((n) => n.kind === 'import' && n.name === '.models');
    expect(importNode).toBeDefined();
    expect(importNode?.references).toContain('User');
  });
});

describe('Python parser — CodeNode shape (PARSE-06)', () => {
  it('all nodes have correct id format: filePath:name:startLine', async () => {
    const result = await parseFile(BASIC_PY);
    for (const node of result.nodes) {
      const expectedId = `${BASIC_PY}:${node.name}:${node.startLine}`;
      expect(node.id).toBe(expectedId);
    }
  });

  it('all nodes have non-empty name and kind', async () => {
    const result = await parseFile(BASIC_PY);
    for (const node of result.nodes) {
      expect(node.name.length).toBeGreaterThan(0);
      expect(node.kind.length).toBeGreaterThan(0);
    }
  });

  it('all nodes have startLine <= endLine', async () => {
    const result = await parseFile(BASIC_PY);
    for (const node of result.nodes) {
      expect(node.startLine).toBeLessThanOrEqual(node.endLine);
    }
  });

  it('all nodes have absolute filePath', async () => {
    const result = await parseFile(BASIC_PY);
    for (const node of result.nodes) {
      expect(path.isAbsolute(node.filePath)).toBe(true);
    }
  });

  it('ParseResult filePath matches requested path', async () => {
    const result = await parseFile(BASIC_PY);
    expect(result.filePath).toBe(BASIC_PY);
    expect(typeof result.parseTimeMs).toBe('number');
    expect(result.parseTimeMs).toBeGreaterThanOrEqual(0);
  });
});
