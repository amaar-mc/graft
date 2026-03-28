// Targeted coverage tests for uncovered branches in src/parser/index.ts
// and src/parser/languages/python.ts + typescript.ts.
// Covers:
//   - file-not-found error path (index.ts line 44-47)
//   - parseFiles empty array (index.ts line 113)
//   - Python wildcard_import branch (python.ts line 250-251)
//   - Python aliased_import branch (python.ts lines 255-260)
//   - TypeScript namespace_import branch (typescript.ts lines 401-404)
//   - TypeScript export re-export (typescript.ts lines 438+)

import path from 'path';
import { describe, it, expect } from 'vitest';
import { parseFile, parseFiles } from '../../src/parser/index.js';
import { ParseError } from '../../src/errors.js';

describe('parseFile coverage gaps', () => {
  it('throws ParseError when file does not exist', async () => {
    await expect(parseFile('/nonexistent/path.ts')).rejects.toThrow(ParseError);
  });

  it('throws ParseError with actionable message for nonexistent file', async () => {
    await expect(parseFile('/nonexistent/path.ts')).rejects.toThrow(
      'Failed to read file',
    );
  });

  it('returns empty ParseResult for unsupported file extension', async () => {
    const result = await parseFile('/some/file.xyz');
    expect(result.filePath).toBe('/some/file.xyz');
    expect(result.nodes).toHaveLength(0);
    expect(result.parseTimeMs).toBe(0);
  });

  it('parses Python fixture to exercise WASM Python grammar code path', async () => {
    const pythonFixture = path.resolve(
      __dirname,
      '../fixtures/python/basic.py',
    );
    const result = await parseFile(pythonFixture);
    expect(result.filePath).toBe(pythonFixture);
    // basic.py has greet function, UserService class, methods etc.
    expect(result.nodes.length).toBeGreaterThan(0);
  });
});

describe('parseFiles coverage gaps', () => {
  it('returns empty array when called with empty input', async () => {
    const results = await parseFiles([]);
    expect(results).toHaveLength(0);
  });
});

describe('Python parser — wildcard and aliased imports (python.ts branch coverage)', () => {
  const advancedImportsFixture = path.resolve(
    __dirname,
    '../fixtures/python/advanced_imports.py',
  );

  it('parses wildcard import (from os import *) — exercises wildcard_import branch', async () => {
    const result = await parseFile(advancedImportsFixture);
    // "from os import *" produces an import node with references containing '*'
    const wildcardNode = result.nodes.find(
      (n) => n.kind === 'import' && n.references.includes('*'),
    );
    expect(wildcardNode).toBeDefined();
  });

  it('parses aliased import (from collections import OrderedDict as OD) — exercises aliased_import branch', async () => {
    const result = await parseFile(advancedImportsFixture);
    // Aliased import uses the alias name (OD) in references
    const aliasedNode = result.nodes.find(
      (n) => n.kind === 'import' && n.references.includes('OD'),
    );
    expect(aliasedNode).toBeDefined();
  });

  it('parses plain aliased import (from json import loads as json_loads)', async () => {
    const result = await parseFile(advancedImportsFixture);
    const aliasedNode = result.nodes.find(
      (n) => n.kind === 'import' && n.references.includes('json_loads'),
    );
    expect(aliasedNode).toBeDefined();
  });

  it('parses plain import with alias (import json as j) — exercises aliased_import in import_statement', async () => {
    const result = await parseFile(advancedImportsFixture);
    // "import json as j" creates an import node with name='j' (the alias)
    const aliasedNode = result.nodes.find(
      (n) => n.kind === 'import' && n.name === 'j',
    );
    expect(aliasedNode).toBeDefined();
  });

  it('parses plain import with dotted alias (import os.path as osp)', async () => {
    const result = await parseFile(advancedImportsFixture);
    // "import os.path as osp" creates an import node with name='osp'
    const aliasedNode = result.nodes.find(
      (n) => n.kind === 'import' && n.name === 'osp',
    );
    expect(aliasedNode).toBeDefined();
  });
});

describe('Python parser — decorator call branch (python.ts line 50)', () => {
  const decoratorCallFixture = path.resolve(
    __dirname,
    '../fixtures/python/decorator_calls.py',
  );

  it('parses class decorated with @dataclass(frozen=True) — exercises call-type decorator branch', async () => {
    const result = await parseFile(decoratorCallFixture);
    const classNode = result.nodes.find(
      (n) => n.kind === 'class' && n.name === 'ImmutablePoint',
    );
    expect(classNode).toBeDefined();
    // The decorator is a call expression — python.ts line 50 fires to push fn name 'dataclass'
    expect(classNode?.references).toContain('dataclass');
  });
});

describe('TypeScript parser — namespace import and export re-exports (typescript.ts branch coverage)', () => {
  const nsImportFixture = path.resolve(
    __dirname,
    '../fixtures/typescript/namespace_import.ts',
  );

  it('parses namespace import (import * as fs) — exercises namespace_import branch', async () => {
    const result = await parseFile(nsImportFixture);
    // namespace import produces an import node with references containing the alias ('fs')
    const nsNode = result.nodes.find(
      (n) => n.kind === 'import' && n.references.includes('fs'),
    );
    expect(nsNode).toBeDefined();
  });

  it('parses export re-export (export { UserId } from) — exercises export_clause branch', async () => {
    const result = await parseFile(nsImportFixture);
    // export { UserId } from './basic' produces an export node
    const exportNode = result.nodes.find(
      (n) => n.kind === 'export' && n.references.includes('UserId'),
    );
    expect(exportNode).toBeDefined();
  });

  it('parses default import (import defaultValue from) — exercises identifier branch in import_clause', async () => {
    const result = await parseFile(nsImportFixture);
    // import defaultValue from './basic' — the import_clause has an 'identifier' child
    const defaultImportNode = result.nodes.find(
      (n) => n.kind === 'import' && n.references.includes('defaultValue'),
    );
    expect(defaultImportNode).toBeDefined();
  });
});
