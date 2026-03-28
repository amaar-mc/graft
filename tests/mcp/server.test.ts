// Integration test: verifies MCP server starts over stdio and responds to JSON-RPC initialize.
// Spawns the built binary (dist/index.cjs serve) and exchanges actual JSON-RPC messages.
// This covers the gap unit tests cannot: that McpServer + StdioServerTransport actually work.

import { spawn, execSync } from 'child_process';
import path from 'path';
import { describe, it, expect, beforeAll } from 'vitest';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DIST_ENTRY = path.join(PROJECT_ROOT, 'dist/index.cjs');
// Use typescript fixture directory as the cwd — small, fast to index
const FIXTURE_DIR = path.join(PROJECT_ROOT, 'tests/fixtures/typescript');

const JSON_RPC_INITIALIZE = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '0.1.0' },
  },
});

beforeAll(() => {
  // Ensure the dist binary is fresh before running this test.
  // Build errors here are a signal of a broken CI state, not a test failure.
  execSync('pnpm build', { cwd: PROJECT_ROOT, stdio: 'pipe' });
}, 60_000);

describe('MCP stdio transport integration', () => {
  it('responds to JSON-RPC initialize over stdio', async () => {
    const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const child = spawn('node', [DIST_ENTRY, 'serve'], {
        cwd: FIXTURE_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdoutBuffer = '';
      const TIMEOUT_MS = 10_000;

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('MCP server did not respond within 10 seconds'));
      }, TIMEOUT_MS);

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString('utf-8');

        // JSON-RPC responses are newline-delimited; attempt to parse each line
        const lines = stdoutBuffer.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '') {
            continue;
          }
          try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            // Accept first parseable JSON-RPC object as the response
            if (typeof parsed === 'object' && parsed !== null && 'jsonrpc' in parsed) {
              clearTimeout(timeout);
              child.kill();
              resolve(parsed);
              return;
            }
          } catch {
            // Not JSON yet — keep buffering
          }
        }
        // Update buffer to remaining unparsed text
        stdoutBuffer = lines[lines.length - 1] ?? '';
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn server: ${err.message}`));
      });

      child.on('exit', (code) => {
        if (code !== null && code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      // Send the JSON-RPC initialize request
      child.stdin.write(JSON_RPC_INITIALIZE + '\n');
    });

    // Validate JSON-RPC protocol compliance
    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(1);
    expect(response.result).toBeDefined();
    expect(response.error).toBeUndefined();

    // Validate server identity and capabilities
    const result = response.result as Record<string, unknown>;
    expect(result.serverInfo).toBeDefined();
    const serverInfo = result.serverInfo as Record<string, unknown>;
    expect(serverInfo.name).toBe('graft');

    expect(result.capabilities).toBeDefined();
    const capabilities = result.capabilities as Record<string, unknown>;
    expect(capabilities).toHaveProperty('tools');
  }, 15_000);

  it('produces no non-JSON-RPC output on stdout before the response', async () => {
    const allOutput = await new Promise<string>((resolve, reject) => {
      const child = spawn('node', [DIST_ENTRY, 'serve'], {
        cwd: FIXTURE_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdoutBuffer = '';
      let responseReceived = false;

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('MCP server did not respond within 10 seconds'));
      }, 10_000);

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString('utf-8');

        if (!responseReceived) {
          const lines = stdoutBuffer.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '') {
              continue;
            }
            try {
              const parsed = JSON.parse(trimmed) as Record<string, unknown>;
              if (typeof parsed === 'object' && parsed !== null && 'jsonrpc' in parsed) {
                responseReceived = true;
                clearTimeout(timeout);
                child.kill();
                resolve(stdoutBuffer);
                return;
              }
            } catch {
              // Keep buffering
            }
          }
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn server: ${err.message}`));
      });

      child.stdin.write(JSON_RPC_INITIALIZE + '\n');
    });

    // Every non-empty line in stdout should be valid JSON
    const lines = allOutput.split('\n').filter((l) => l.trim() !== '');
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  }, 15_000);
});
