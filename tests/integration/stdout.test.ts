// INFRA-05: Stdout contamination integration test.
// Part 1: In-process tests — verifies the parser pipeline writes zero bytes to stdout.
// Part 2: Subprocess tests — verifies CLI commands only write output to stdout (no spinners/logs),
//         and that MCP serve mode does NOT write any non-JSON-RPC content to stdout.

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import path from 'path';
import { spawn } from 'child_process';
import { parseFiles } from '../../src/parser/index';

const FIXTURES_TS = path.resolve(__dirname, '../fixtures/typescript');
const FIXTURES_JS = path.resolve(__dirname, '../fixtures/javascript');
const FIXTURES_PY = path.resolve(__dirname, '../fixtures/python');

// Path to the compiled CLI entry point (built by tsup)
const DIST_CLI = path.resolve(__dirname, '../../dist/index.cjs');
// Use the typescript fixture directory as a minimal project for CLI commands
const FIXTURE_ROOT = FIXTURES_TS;

// Spawn a CLI subprocess and collect stdout + stderr separately.
// Resolves when the process exits.
function spawnCli(
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [DIST_CLI, ...args], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Spawn MCP serve mode, give it a moment to start, then kill and collect output.
// We send no stdin — a real MCP client would send JSON-RPC, but this test just verifies
// that no startup banners or spinners leak to stdout before any client message.
function spawnServeAndCapture(
  cwd: string,
  waitMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [DIST_CLI, 'serve'], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    // Close stdin immediately so the server doesn't wait for input
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
    }, waitMs);

    proc.on('close', () => {
      clearTimeout(timer);
      resolve({ stdout, stderr });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── Part 1: In-process parser stdout purity ───────────────────────────────────

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

// ── Part 2: CLI subprocess stream separation (CLI-06) ─────────────────────────

describe('CLI subprocess stream separation (CLI-06)', () => {
  beforeAll(() => {
    // Verify the built CLI exists before running subprocess tests
    const fs = require('fs') as typeof import('fs');
    if (!fs.existsSync(DIST_CLI)) {
      throw new Error(
        `Built CLI not found at ${DIST_CLI}. Run 'pnpm build' before running these tests.`,
      );
    }
  });

  it('map command: stdout contains only tree output, no ANSI or graft: log prefix', async () => {
    const { stdout, stderr, exitCode } = await spawnCli(
      ['map', '--budget', '512'],
      FIXTURE_ROOT,
      10000,
    );

    expect(exitCode).toBe(0);

    // stdout must not contain graft log prefix
    expect(stdout).not.toContain('[graft:');
    // stdout must not contain spinner frame characters (ora uses these)
    expect(stdout).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/u);
    // stdout should have some content (the tree output)
    expect(stdout.trim().length).toBeGreaterThan(0);
    // stderr should contain progress indication (spinner + log output)
    expect(stderr.length).toBeGreaterThan(0);
  });

  it('stats command: stdout contains stats output, stderr has spinner activity', async () => {
    const { stdout, stderr, exitCode } = await spawnCli(['stats'], FIXTURE_ROOT, 10000);

    expect(exitCode).toBe(0);

    // stdout must not contain graft log prefix
    expect(stdout).not.toContain('[graft:');
    // stdout must not contain spinner frames
    expect(stdout).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/u);
    // stdout should contain stats content
    expect(stdout.trim().length).toBeGreaterThan(0);
    // stderr should contain progress indication
    expect(stderr.length).toBeGreaterThan(0);
  });

  it('search command: stdout contains search results, stderr has spinner activity', async () => {
    const { stdout, stderr, exitCode } = await spawnCli(
      ['search', 'function'],
      FIXTURE_ROOT,
      10000,
    );

    expect(exitCode).toBe(0);

    // stdout must not contain graft log prefix
    expect(stdout).not.toContain('[graft:');
    // stdout must not contain spinner frames
    expect(stdout).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/u);
    // stdout should have some content (search results or "0 matches")
    expect(stdout.trim().length).toBeGreaterThan(0);
    // stderr should contain progress indication
    expect(stderr.length).toBeGreaterThan(0);
  });

  it('serve command: stdout is empty on startup (no banner or spinner leaks to stdout)', async () => {
    // Spawn serve, close stdin immediately, wait briefly, then kill.
    // No JSON-RPC has been sent, so the server is just waiting.
    // No startup message should appear on stdout — that would corrupt MCP client sessions.
    const { stdout } = await spawnServeAndCapture(FIXTURE_ROOT, 1500);

    // The critical invariant: stdout must contain only valid JSON-RPC or nothing.
    // When we close stdin without sending anything, the server exits — stdout should be empty.
    expect(stdout).toBe('');
  });
});
