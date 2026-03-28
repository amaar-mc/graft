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

  it('graft_map with explicit budget exercises the params.budget defined branch', async () => {
    // params.budget defined → exercises the non-null ?? branch (budget = params.budget, not 2048)
    const result = await client.callTool({
      name: 'graft_map',
      arguments: { budget: 512 },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('tokens');
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

  it('graft_context for types.ts shows (none) for Dependencies (no imports)', async () => {
    // types.ts has no imports — exercises the forward.size === 0 branch in buildFileContextText
    const result = await client.callTool({
      name: 'graft_context',
      arguments: { path: 'types.ts' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('Dependencies');
    expect(text).toContain('(none)');
  });

  it('graft_context for nonexistent path shows (none) for all sections', async () => {
    // A path not in the graph — exercises ?? 0 score fallback, defs.length === 0,
    // forward.size === 0, and reverse.size === 0 branches all at once
    const result = await client.callTool({
      name: 'graft_context',
      arguments: { path: 'nonexistent-file.ts' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('Definitions');
    expect(text).toContain('(none)');
    expect(text).toContain('[score: 0.0000]');
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

  it('graft_search with kind filter returns filtered results', async () => {
    // Query with kind='type' — exercises the params.kind !== undefined branch
    const result = await client.callTool({
      name: 'graft_search',
      arguments: { query: 'UserId', kind: 'type' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    // 'type UserId' should match; 'interface User' should be filtered out by kind='type'
    expect(text).toMatch(/\d+ match/);
  });

  it('graft_search returns singular "1 match" for unique exact query', async () => {
    // 'buildUserList' is a unique function name — exactly 1 match expected
    // Exercises the matches.length === 1 branch: "1 match" (singular, not "matches")
    const result = await client.callTool({
      name: 'graft_search',
      arguments: { query: 'buildUserList' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('1 match');
  });

  it('graft_search with no results returns "0 matches"', async () => {
    // Exercises the matches.length === 0 branch → text = header only (no newline+matches)
    const result = await client.callTool({
      name: 'graft_search',
      arguments: { query: 'zzznonexistentsymbol_xyz' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toBe('0 matches');
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

  it('graft_summary includes tech stack from package.json when present', async () => {
    // The ts-project fixture has package.json — exercises the try-success branch in handleGraftSummary
    const result = await client.callTool({ name: 'graft_summary', arguments: {} });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toContain('Tech Stack');
    // package.json has lodash and typescript as deps — exercises deps.length > 0 branch
    expect(text).toContain('lodash');
  });

  it('graft_impact for index.ts (no dependents) returns singular "1 file affected"', async () => {
    // index.ts is not imported by any other file in the fixture — transitive closure = {index.ts}
    // Exercises the lines.length === 1 branch: "1 file affected" (singular, not "files")
    const result = await client.callTool({
      name: 'graft_impact',
      arguments: { path: 'index.ts' },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { type: string; text: string }).text;
    // Verify it's singular "file" not plural "files"
    expect(text).toMatch(/^1 file affected/);
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
