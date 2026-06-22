// Web Stylebook MCP server factory (02 §14). SDK is imported ONLY here / cli /
// protocol — the engines stay SDK-free pure functions (ADR-005).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CatalogRepository } from './catalog/repository.js';
import { registerResources } from './protocol/register-resources.js';
import { registerTools } from './protocol/register-tools.js';
import { registerPrompts } from './protocol/register-prompts.js';
import { SERVER_NAME, SERVER_VERSION } from './server-info.js';

export function createWebStylebookServer(repo: CatalogRepository = CatalogRepository.load()): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerResources(server, repo);
  registerTools(server, repo);
  registerPrompts(server);
  return server;
}

export async function runStdio(): Promise<void> {
  const server = createWebStylebookServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is reserved for JSON-RPC; logs go to stderr only.
  console.error(`[${SERVER_NAME}-mcp] connected via stdio (v${SERVER_VERSION})`);
}

export { CatalogRepository };
