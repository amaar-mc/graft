import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { discoverFiles } from '../../src/indexer/discovery';
import { DiscoveryError } from '../../src/errors';

// Helper to create a file with optional content
function touch(filePath: string, content = ''): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe('discoverFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graft-discovery-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('discovers .ts, .tsx, .js, .mjs, .cjs, .py files', async () => {
    touch(path.join(tmpDir, 'a.ts'));
    touch(path.join(tmpDir, 'b.tsx'));
    touch(path.join(tmpDir, 'c.js'));
    touch(path.join(tmpDir, 'd.mjs'));
    touch(path.join(tmpDir, 'e.cjs'));
    touch(path.join(tmpDir, 'f.py'));
    touch(path.join(tmpDir, 'g.json')); // should not be included
    touch(path.join(tmpDir, 'h.md')); // should not be included

    const files = await discoverFiles(tmpDir);
    const names = files.map((f) => path.basename(f)).sort();

    expect(names).toEqual(['a.ts', 'b.tsx', 'c.js', 'd.mjs', 'e.cjs', 'f.py']);
  });

  it('ignores node_modules by default', async () => {
    touch(path.join(tmpDir, 'src', 'index.ts'));
    touch(path.join(tmpDir, 'node_modules', 'some-lib', 'index.ts'));

    const files = await discoverFiles(tmpDir);
    const hasNodeModules = files.some((f) => f.includes('node_modules'));
    expect(hasNodeModules).toBe(false);
    expect(files.length).toBe(1);
  });

  it('ignores dist, build, .git, vendor by default', async () => {
    touch(path.join(tmpDir, 'src', 'main.ts'));
    touch(path.join(tmpDir, 'dist', 'index.js'));
    touch(path.join(tmpDir, 'build', 'app.js'));
    touch(path.join(tmpDir, '.git', 'hooks', 'pre-commit'));
    touch(path.join(tmpDir, 'vendor', 'lib.py'));

    const files = await discoverFiles(tmpDir);
    const names = files.map((f) => path.basename(f));
    expect(names).toEqual(['main.ts']);
  });

  it('ignores .d.ts and .min.js files by default', async () => {
    touch(path.join(tmpDir, 'index.ts'));
    touch(path.join(tmpDir, 'index.d.ts'));
    touch(path.join(tmpDir, 'app.min.js'));
    touch(path.join(tmpDir, 'bundle.bundle.js'));
    touch(path.join(tmpDir, 'map.map'));

    const files = await discoverFiles(tmpDir);
    const names = files.map((f) => path.basename(f));
    expect(names).toEqual(['index.ts']);
  });

  it('respects .gitignore rules', async () => {
    touch(path.join(tmpDir, 'src', 'app.ts'));
    touch(path.join(tmpDir, 'src', 'generated.ts'));
    touch(path.join(tmpDir, 'src', 'secret.py'));
    fs.writeFileSync(
      path.join(tmpDir, '.gitignore'),
      'src/generated.ts\nsrc/secret.py\n',
    );

    const files = await discoverFiles(tmpDir);
    const names = files.map((f) => path.basename(f));
    expect(names).toEqual(['app.ts']);
  });

  it('respects .gitignore negation patterns', async () => {
    touch(path.join(tmpDir, 'src', 'a.generated.ts'));
    touch(path.join(tmpDir, 'src', 'important.generated.ts'));
    touch(path.join(tmpDir, 'src', 'normal.ts'));
    fs.writeFileSync(
      path.join(tmpDir, '.gitignore'),
      '*.generated.ts\n!src/important.generated.ts\n',
    );

    const files = await discoverFiles(tmpDir);
    const names = files.map((f) => path.basename(f)).sort();
    expect(names).toEqual(['important.generated.ts', 'normal.ts']);
  });

  it('respects .graftignore rules', async () => {
    touch(path.join(tmpDir, 'src', 'app.ts'));
    touch(path.join(tmpDir, 'src', 'legacy.ts'));
    touch(path.join(tmpDir, 'scripts', 'deploy.py'));
    fs.writeFileSync(
      path.join(tmpDir, '.graftignore'),
      'src/legacy.ts\nscripts/\n',
    );

    const files = await discoverFiles(tmpDir);
    const names = files.map((f) => path.basename(f));
    expect(names).toEqual(['app.ts']);
  });

  it('respects extra ignore patterns passed as argument', async () => {
    touch(path.join(tmpDir, 'src', 'app.ts'));
    touch(path.join(tmpDir, 'src', 'test.ts'));
    touch(path.join(tmpDir, 'helpers', 'util.py'));

    const files = await discoverFiles(tmpDir, ['src/test.ts', 'helpers/']);
    const names = files.map((f) => path.basename(f));
    expect(names).toEqual(['app.ts']);
  });

  it('works with zero config (no .gitignore, no .graftignore)', async () => {
    touch(path.join(tmpDir, 'index.ts'));
    touch(path.join(tmpDir, 'app.js'));
    touch(path.join(tmpDir, 'utils.py'));

    const files = await discoverFiles(tmpDir);
    expect(files.length).toBe(3);
  });

  it('returns absolute paths', async () => {
    touch(path.join(tmpDir, 'src', 'index.ts'));
    touch(path.join(tmpDir, 'src', 'util.py'));

    const files = await discoverFiles(tmpDir);
    for (const f of files) {
      expect(path.isAbsolute(f)).toBe(true);
    }
  });

  it('returns sorted paths', async () => {
    touch(path.join(tmpDir, 'z.ts'));
    touch(path.join(tmpDir, 'a.ts'));
    touch(path.join(tmpDir, 'm.ts'));

    const files = await discoverFiles(tmpDir);
    expect(files).toEqual([...files].sort());
  });

  it('returns empty array for empty directory (no source files)', async () => {
    // Empty tmp dir — no source files
    const files = await discoverFiles(tmpDir);
    expect(files).toEqual([]);
  });

  it('returns empty array for directory with only non-source files', async () => {
    touch(path.join(tmpDir, 'readme.md'));
    touch(path.join(tmpDir, 'data.json'));
    touch(path.join(tmpDir, 'image.png'));

    const files = await discoverFiles(tmpDir);
    expect(files).toEqual([]);
  });

  it('throws DiscoveryError for non-existent directory', async () => {
    const nonExistent = path.join(tmpDir, 'does-not-exist');

    await expect(discoverFiles(nonExistent)).rejects.toThrow(DiscoveryError);
    await expect(discoverFiles(nonExistent)).rejects.toMatchObject({
      hint: expect.stringContaining('Check that the directory path is correct'),
    });
  });
});
