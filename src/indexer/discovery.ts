import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import ignore, { type Ignore } from 'ignore';
import { DiscoveryError } from '../errors';
import { info, debug } from '../logger';

// Directories and file patterns always excluded — no config needed
const DEFAULT_IGNORE_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
  '.git',
  'vendor',
];

const DEFAULT_IGNORE_FILES = ['*.min.js', '*.d.ts', '*.map', '*.bundle.js'];

const SOURCE_EXTENSIONS = '**/*.{ts,tsx,js,mjs,cjs,py}';

function createIgnoreInstance(extraPatterns: readonly string[]): Ignore {
  const ig = ignore();

  // Add default directory ignores
  for (const dir of DEFAULT_IGNORE_DIRS) {
    ig.add(dir);
    ig.add(`${dir}/`);
  }

  // Add default file ignores
  for (const pattern of DEFAULT_IGNORE_FILES) {
    ig.add(pattern);
  }

  // Add extra patterns from caller
  for (const pattern of extraPatterns) {
    ig.add(pattern);
  }

  return ig;
}

function readIgnoreFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function discoverFiles(
  rootDir: string,
  extraIgnorePatterns: readonly string[] = [],
): Promise<string[]> {
  // Validate that rootDir exists
  if (!fs.existsSync(rootDir)) {
    throw new DiscoveryError(
      `Directory does not exist: ${rootDir}`,
      'Check that the directory path is correct and exists',
    );
  }

  const startMs = Date.now();

  const ig = createIgnoreInstance(extraIgnorePatterns);

  // Load .gitignore if present
  const gitignorePath = path.join(rootDir, '.gitignore');
  const gitignoreContent = readIgnoreFile(gitignorePath);
  if (gitignoreContent !== null) {
    ig.add(gitignoreContent);
    debug('Loaded .gitignore', { path: gitignorePath });
  }

  // Load .graftignore if present
  const graftignorePath = path.join(rootDir, '.graftignore');
  const graftignoreContent = readIgnoreFile(graftignorePath);
  if (graftignoreContent !== null) {
    ig.add(graftignoreContent);
    debug('Loaded .graftignore', { path: graftignorePath });
  }

  // Enumerate all source files with fast-glob
  const rawFiles = await fg(SOURCE_EXTENSIONS, {
    cwd: rootDir,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
    // Exclude default dirs at glob level for performance
    ignore: DEFAULT_IGNORE_DIRS.map((d) => `**/${d}/**`),
  });

  // Filter through ignore rules using relative paths (ignore package requires relative paths)
  const filtered = rawFiles.filter((absolutePath) => {
    const relativePath = path.relative(rootDir, absolutePath);
    const shouldIgnore = ig.ignores(relativePath);
    if (shouldIgnore) {
      debug('Ignored file', { path: relativePath });
    }
    return !shouldIgnore;
  });

  // Sort alphabetically for deterministic output
  filtered.sort();

  const elapsed = Date.now() - startMs;
  info('File discovery complete', {
    root: rootDir,
    found: filtered.length,
    elapsed_ms: elapsed,
  });

  return filtered;
}
