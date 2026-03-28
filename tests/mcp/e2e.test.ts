// E2E MCP tests that exercise the full server wiring via InMemoryTransport.
// Uses createGraftServer() to create a configured server and a real MCP Client
// to call all 5 tools and both resources — no subprocess, no stdin.
// These tests contribute V8 coverage for src/mcp/server.ts lines 238-322.

import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createGraftServer } from '../../src/mcp/server.js';

const fixtureDir = path.resolve(__dirname, '../fixtures/integration/ts-project');

describe('MCP E2E via InMemoryTransport', { timeout: 30000 }, () => {
  let client: Client;

  beforeAll(async () => {
    const server = createGraftServer(fixtureDir);
    client = new Client({ name: 'e2e-test', version: '0.0.1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  });

  afterAll(async () => {
    await client.close();
    // Clean up cache produced by indexing the fixture during tests
    await fs.promises.rm(path.join(fixtureDir, '.graft'), { recursive: true, force: true });
  });

  // ── Tool: graft_map ───────────────────────────────────────────────────────────

  it('graft_map returns ranked tree text', async () => {
    const result = await client.callTool({ name: 'graft_map', arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    const text = (result.content[0] as { type: string; text: string }).text;
    // renderTree footer always contains token count
    expect(text).toContain('tokens');
  });

  it('graft_map with query personalizes results', async () => {
    const result = await client.callTool({
      name: 'graft_map',
      arguments: { query: 'index.ts' },
    });
    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  // ── Tool: graft_context ───────────────────────────────────────────────────────

  it('graft_context returns file context with Definitions and Dependencies sections', async () => {
    const result = await client.callTool({
      name: 'graft_context',
      arguments: { path: 'index.ts' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('Definitions');
    expect(text).toContain('Dependencies');
  });

  // ── Tool: graft_search ────────────────────────────────────────────────────────

  it('graft_search finds User type definition', async () => {
    const result = await client.callTool({
      name: 'graft_search',
      arguments: { query: 'User' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    // types.ts defines User and UserId — at least 1 match expected
    expect(text).toMatch(/\d+ match/);
    const matchCount = parseInt(text.match(/^(\d+) match/)?.[1] ?? '0', 10);
    expect(matchCount).toBeGreaterThanOrEqual(1);
  });

  // ── Tool: graft_impact ────────────────────────────────────────────────────────

  it('graft_impact returns affected files for types.ts', async () => {
    const result = await client.callTool({
      name: 'graft_impact',
      arguments: { path: 'types.ts' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('affected');
    // index.ts and utils.ts both import from types.ts — at least 1 affected file
    const affectedCount = parseInt(text.match(/^(\d+) file/)?.[1] ?? '0', 10);
    expect(affectedCount).toBeGreaterThanOrEqual(1);
  });

  // ── Tool: graft_summary ───────────────────────────────────────────────────────

  it('graft_summary returns project overview with stats', async () => {
    const result = await client.callTool({ name: 'graft_summary', arguments: {} });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('Project Stats');
    expect(text).toContain('Files:');
  });

  // ── Resource: graft://map ─────────────────────────────────────────────────────

  it('graft://map resource returns ranked codebase tree', async () => {
    const response = await client.readResource({ uri: 'graft://map' });
    expect(response.contents).toHaveLength(1);
    const text = (response.contents[0] as { uri: string; text: string }).text;
    expect(text).toContain('tokens');
  });

  // ── Resource: graft://file/{path} ─────────────────────────────────────────────

  it('graft://file/index.ts resource returns file context with Definitions', async () => {
    const response = await client.readResource({ uri: 'graft://file/index.ts' });
    expect(response.contents).toHaveLength(1);
    const text = (response.contents[0] as { uri: string; text: string }).text;
    expect(text).toContain('Definitions');
  });
});
