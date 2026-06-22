// Tool result helpers (ADR-008). Always return structuredContent + a text fallback;
// large detail is linked via resource_link, and the URIs are ALSO written into the
// text so clients without resource_link support still see them.

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ToolError, ToolErrorPayload } from './errors.js';

export type ToolResult = CallToolResult;

export function ok(structured: Record<string, unknown>, text: string, resourceUris: string[] = []): CallToolResult {
  const content: CallToolResult['content'] = [{ type: 'text', text: appendUris(text, resourceUris) }];
  for (const uri of resourceUris) content.push({ type: 'resource_link', uri, name: uri });
  return { content, structuredContent: structured };
}

function appendUris(text: string, uris: string[]): string {
  if (!uris.length) return text;
  return `${text}\n\nResources:\n${uris.map((u) => `- ${u}`).join('\n')}`;
}

export function errorResult(err: ToolError): CallToolResult {
  const payload: ToolErrorPayload = err.payload();
  const lines = [payload.error.message];
  if (payload.suggestions?.length) lines.push(`Suggestions: ${payload.suggestions.join(', ')}`);
  return {
    isError: true,
    content: [{ type: 'text', text: lines.join('\n') }],
    structuredContent: payload as unknown as Record<string, unknown>,
  };
}
