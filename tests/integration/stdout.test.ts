// INFRA-05: Stdout contamination integration test.
// Verifies that the parser pipeline writes zero bytes to stdout during parsing.
// Any stdout output during parsing would corrupt MCP sessions, which communicate over stdout.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { parseFiles } from '../../src/parser/index';

const FIXTURES_TS = path.resolve(__dirname, '../fixtures/typescript');
const FIXTURES_JS = path.resolve(__dirname, '../fixtures/javascript');
const FIXTURES_PY = path.resolve(__dirname, '../fixtures/python');

describe('stdout contamination (INFRA-05)', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let capturedBytes: number;

  beforeEach(() => {
    capturedBytes = 0;
    // Intercept process.stdout.write to capture any bytes written to stdout.
    // The original write is not called — if the parser does NOT write to stdout,
    // this spy will never be invoked.
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(
      (chunk: unknown): boolean => {
        if (typeof chunk === 'string') {
          capturedBytes += Buffer.byteLength(chunk, 'utf-8');
        } else if (chunk instanceof Buffer) {
          capturedBytes += chunk.byteLength;
        } else if (chunk instanceof Uint8Array) {
          capturedBytes += chunk.byteLength;
        }
        return true;
      },
    );
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('produces zero bytes on stdout when parsing TypeScript files', async () => {
    const files = [
      path.join(FIXTURES_TS, 'basic.ts'),
      path.join(FIXTURES_TS, 'barrel.ts'),
      path.join(FIXTURES_TS, 'react.tsx'),
    ];

    await parseFiles(files);

    expect(capturedBytes).toBe(0);
  });

  it('produces zero bytes on stdout when parsing JavaScript files', async () => {
    const files = [path.join(FIXTURES_JS, 'basic.js')];

    await parseFiles(files);

    expect(capturedBytes).toBe(0);
  });

  it('produces zero bytes on stdout when parsing Python files', async () => {
    const files = [
      path.join(FIXTURES_PY, 'basic.py'),
      path.join(FIXTURES_PY, 'classes.py'),
      path.join(FIXTURES_PY, 'imports.py'),
    ];

    await parseFiles(files);

    expect(capturedBytes).toBe(0);
  });

  it('produces zero bytes on stdout when parsing mixed language files', async () => {
    const files = [
      path.join(FIXTURES_TS, 'basic.ts'),
      path.join(FIXTURES_JS, 'basic.js'),
      path.join(FIXTURES_PY, 'basic.py'),
    ];

    await parseFiles(files);

    expect(capturedBytes).toBe(0);
  });
});
