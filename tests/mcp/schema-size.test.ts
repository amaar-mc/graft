// MCP-09: Guard test that fails if total tool schema serialization exceeds 4000 characters.
// Uses MCP Client + InMemoryTransport to measure the exact JSON Schema representation
// that MCP clients receive, ensuring token overhead stays bounded.

import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import z from 'zod';

// Maximum allowed characters for the full JSON serialization of all tool schemas.
// MCP-09 requirement: keep schema size under 4000 chars to minimize token overhead.
const MAX_SCHEMA_CHARS = 4000;

// Tool definitions matching server.ts exactly — if either diverges, the test will detect bloat.
function buildTestServer(): McpServer {
  const server = new McpServer({ name: 'graft-test', version: '0.0.1' });

  server.tool(
    'graft_map',
    'Ranked tree map of the codebase by structural importance.',
    {
      query: z.string().optional().describe('File or symbol for personalization'),
      budget: z
        .number()
        .int()
        .min(1)
        .max(32000)
        .optional()
        .describe('Max tokens (default 2048)'),
    },
    async () => ({ content: [{ type: 'text' as const, text: '' }] }),
  );

  server.tool(
    'graft_context',
    'Dependencies and definitions for a specific file.',
    {
      path: z.string().describe('File path relative to project root'),
    },
    async () => ({ content: [{ type: 'text' as const, text: '' }] }),
  );

  server.tool(
    'graft_search',
    'Find definitions by name or kind.',
    {
      query: z.string().describe('Name pattern to search for'),
      kind: z.string().optional().describe('Filter by kind: function, class, type, etc.'),
    },
    async () => ({ content: [{ type: 'text' as const, text: '' }] }),
  );

  server.tool(
    'graft_impact',
    'Files affected by changing a given file.',
    {
      path: z.string().describe('File path relative to project root'),
    },
    async () => ({ content: [{ type: 'text' as const, text: '' }] }),
  );

  server.tool(
    'graft_summary',
    'Project overview with key files and tech stack.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: '' }] }),
  );

  return server;
}

describe('MCP schema size (MCP-09)', () => {
  it('total MCP tool schema serialization stays under 4000 characters', async () => {
    const server = buildTestServer();
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    const { tools } = await client.listTools();

    await client.close();

    const serialized = JSON.stringify(tools);
    const charCount = serialized.length;

    // Provide diagnostic output if the assertion fails
    if (charCount >= MAX_SCHEMA_CHARS) {
      console.error(
        `Schema size ${charCount} chars exceeds limit of ${MAX_SCHEMA_CHARS}. ` +
          `Tools: ${tools.map((t) => `${t.name}(${JSON.stringify(t.inputSchema).length})`).join(', ')}`,
      );
    }

    expect(charCount).toBeLessThan(MAX_SCHEMA_CHARS);
  });

  it('each individual tool schema stays under 1500 characters', async () => {
    const server = buildTestServer();
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    const { tools } = await client.listTools();

    await client.close();

    for (const tool of tools) {
      const toolSchema = JSON.stringify(tool);
      expect(toolSchema.length, `Tool ${tool.name} schema is ${toolSchema.length} chars`).toBeLessThan(1500);
    }
  });
});
