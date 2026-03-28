// Integration tests for the full discover-parse-graph-rank pipeline.
// Runs against three fixture codebases: TypeScript, Python, and mixed-language.
// No mocking — these exercise the entire pipeline end-to-end.

import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { buildIndex } from '../../src/indexer/pipeline.js';

const TS_PROJECT = path.resolve(__dirname, '../fixtures/integration/ts-project');
const PYTHON_PROJECT = path.resolve(__dirname, '../fixtures/integration/python-project');
const MIXED_PROJECT = path.resolve(__dirname, '../fixtures/integration/mixed-project');

// Remove cache directory after each test to prevent cross-test contamination.
function cleanCache(fixtureDir: string): void {
  const cacheDir = path.join(fixtureDir, '.graft');
  fs.rmSync(cacheDir, { recursive: true, force: true });
}

// ── TypeScript project fixture ─────────────────────────────────────────────────

describe(
  'TypeScript project fixture',
  { timeout: 30000 },
  () => {
    afterEach(() => {
      cleanCache(TS_PROJECT);
    });

    it('returns at least 3 files in the files array', async () => {
      const { files } = await buildIndex(TS_PROJECT);
      expect(files.length).toBeGreaterThanOrEqual(3);
    });

    it('graph has a forward edge from index.ts to utils.ts', async () => {
      const { graph } = await buildIndex(TS_PROJECT);
      const indexFile = path.join(TS_PROJECT, 'index.ts');
      const utilsFile = path.join(TS_PROJECT, 'utils.ts');
      const edges = graph.forwardEdges.get(indexFile);
      expect(edges).toBeDefined();
      expect(edges!.has(utilsFile)).toBe(true);
    });

    it('graph has a forward edge from index.ts to types.ts', async () => {
      const { graph } = await buildIndex(TS_PROJECT);
      const indexFile = path.join(TS_PROJECT, 'index.ts');
      const typesFile = path.join(TS_PROJECT, 'types.ts');
      const edges = graph.forwardEdges.get(indexFile);
      expect(edges).toBeDefined();
      expect(edges!.has(typesFile)).toBe(true);
    });

    it('graph has a forward edge from utils.ts to types.ts', async () => {
      const { graph } = await buildIndex(TS_PROJECT);
      const utilsFile = path.join(TS_PROJECT, 'utils.ts');
      const typesFile = path.join(TS_PROJECT, 'types.ts');
      const edges = graph.forwardEdges.get(utilsFile);
      expect(edges).toBeDefined();
      expect(edges!.has(typesFile)).toBe(true);
    });

    it('types.ts ranks higher than index.ts (most-depended-on file ranks higher)', async () => {
      const { scores } = await buildIndex(TS_PROJECT);
      const indexFile = path.join(TS_PROJECT, 'index.ts');
      const typesFile = path.join(TS_PROJECT, 'types.ts');
      const typesScore = scores.get(typesFile) ?? 0;
      const indexScore = scores.get(indexFile) ?? 0;
      expect(typesScore).toBeGreaterThan(indexScore);
    });

    it('all files have definition entries in the definitions map', async () => {
      const { graph, files } = await buildIndex(TS_PROJECT);
      for (const file of files) {
        expect(graph.definitions.has(file)).toBe(true);
      }
    });
  },
);

// ── Python project fixture ─────────────────────────────────────────────────────

describe(
  'Python project fixture',
  { timeout: 30000 },
  () => {
    afterEach(() => {
      cleanCache(PYTHON_PROJECT);
    });

    it('returns at least 3 files in the files array', async () => {
      const { files } = await buildIndex(PYTHON_PROJECT);
      expect(files.length).toBeGreaterThanOrEqual(3);
    });

    it('graph has a forward edge from main.py to models.py', async () => {
      const { graph } = await buildIndex(PYTHON_PROJECT);
      const mainFile = path.join(PYTHON_PROJECT, 'main.py');
      const modelsFile = path.join(PYTHON_PROJECT, 'models.py');
      const edges = graph.forwardEdges.get(mainFile);
      expect(edges).toBeDefined();
      expect(edges!.has(modelsFile)).toBe(true);
    });

    it('graph has a forward edge from __init__.py to models.py', async () => {
      const { graph } = await buildIndex(PYTHON_PROJECT);
      const initFile = path.join(PYTHON_PROJECT, '__init__.py');
      const modelsFile = path.join(PYTHON_PROJECT, 'models.py');
      const edges = graph.forwardEdges.get(initFile);
      expect(edges).toBeDefined();
      expect(edges!.has(modelsFile)).toBe(true);
    });

    it('models.py ranks higher than main.py in PageRank scores', async () => {
      const { scores } = await buildIndex(PYTHON_PROJECT);
      const mainFile = path.join(PYTHON_PROJECT, 'main.py');
      const modelsFile = path.join(PYTHON_PROJECT, 'models.py');
      const modelsScore = scores.get(modelsFile) ?? 0;
      const mainScore = scores.get(mainFile) ?? 0;
      expect(modelsScore).toBeGreaterThan(mainScore);
    });

    it('definitions include at least 2 class definitions from models.py', async () => {
      const { graph } = await buildIndex(PYTHON_PROJECT);
      const modelsFile = path.join(PYTHON_PROJECT, 'models.py');
      const defs = graph.definitions.get(modelsFile) ?? [];
      const classDefs = defs.filter((d) => d.kind === 'class');
      expect(classDefs.length).toBeGreaterThanOrEqual(2);
    });
  },
);

// ── Mixed-language project fixture ────────────────────────────────────────────

describe(
  'Mixed-language project fixture',
  { timeout: 30000 },
  () => {
    afterEach(() => {
      cleanCache(MIXED_PROJECT);
    });

    it('returns files from both languages (at least 4 files)', async () => {
      const { files } = await buildIndex(MIXED_PROJECT);
      expect(files.length).toBeGreaterThanOrEqual(4);
      const tsFiles = files.filter((f) => f.endsWith('.ts'));
      const pyFiles = files.filter((f) => f.endsWith('.py'));
      expect(tsFiles.length).toBeGreaterThanOrEqual(1);
      expect(pyFiles.length).toBeGreaterThanOrEqual(1);
    });

    it('TS cluster has a forward edge from app.ts to helpers.ts', async () => {
      const { graph } = await buildIndex(MIXED_PROJECT);
      const appFile = path.join(MIXED_PROJECT, 'app.ts');
      const helpersFile = path.join(MIXED_PROJECT, 'helpers.ts');
      const edges = graph.forwardEdges.get(appFile);
      expect(edges).toBeDefined();
      expect(edges!.has(helpersFile)).toBe(true);
    });

    it('Python cluster has a forward edge from config.py to utils.py', async () => {
      const { graph } = await buildIndex(MIXED_PROJECT);
      const configFile = path.join(MIXED_PROJECT, 'config.py');
      const utilsFile = path.join(MIXED_PROJECT, 'utils.py');
      const edges = graph.forwardEdges.get(configFile);
      expect(edges).toBeDefined();
      expect(edges!.has(utilsFile)).toBe(true);
    });

    it('no .ts file has a forward edge to any .py file (no cross-language edges)', async () => {
      const { graph } = await buildIndex(MIXED_PROJECT);
      for (const [source, targets] of graph.forwardEdges) {
        if (!source.endsWith('.ts')) continue;
        for (const target of targets) {
          expect(target.endsWith('.py')).toBe(false);
        }
      }
    });

    it('no .py file has a forward edge to any .ts file (no cross-language edges)', async () => {
      const { graph } = await buildIndex(MIXED_PROJECT);
      for (const [source, targets] of graph.forwardEdges) {
        if (!source.endsWith('.py')) continue;
        for (const target of targets) {
          expect(target.endsWith('.ts')).toBe(false);
        }
      }
    });
  },
);
