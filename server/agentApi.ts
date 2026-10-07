// HTTP layer for the agent endpoints, shared by the Vercel functions and the dev server.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { clientIp, readJson, sendJson, setCors } from './http.ts';
import { allow } from './limit.ts';
import { handleMcp, SERVER_INFO } from './mcp.ts';
import { callTool, TOOLS } from './tools.ts';

const PER_MINUTE = 40;

function baseUrl(req: IncomingMessage): string {
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost');
  const proto = String(req.headers['x-forwarded-proto'] ?? (host.startsWith('localhost') ? 'http' : 'https'));
  return `${proto}://${host}`;
}

function preflight(req: IncomingMessage, res: ServerResponse): boolean {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export async function mcpRoute(req: IncomingMessage, res: ServerResponse, apiKey: string | undefined): Promise<void> {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST, OPTIONS');
    return sendJson(res, 405, { error: 'This is a stateless MCP endpoint. Send JSON-RPC with POST.' });
  }
  if (!allow(`mcp:${clientIp(req)}`, PER_MINUTE, 60_000)) {
    return sendJson(res, 429, { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Rate limit: please slow down.' } });
  }
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  const out = await handleMcp(body, apiKey);
  if (out.body === null) {
    res.statusCode = out.status;
    res.end();
    return;
  }
  sendJson(res, out.status, out.body);
}

export async function toolsRoute(req: IncomingMessage, res: ServerResponse, apiKey: string | undefined): Promise<void> {
  if (preflight(req, res)) return;
  const base = baseUrl(req);
  if (req.method === 'GET') {
    return sendJson(res, 200, {
      name: SERVER_INFO.name,
      description:
        'Read-only risk signals for Monad Testnet (chain 10143). Tools never sign or send transactions. Scores are signals, not verdicts.',
      mcp: { transport: 'streamable-http', url: `${base}/api/mcp` },
      call: { method: 'POST', url: `${base}/api/agent-tools`, body: { tool: '<name>', arguments: '<object matching the tool inputSchema>' } },
      tools: TOOLS,
    });
  }
  if (req.method !== 'POST') {
    res.setHeader('allow', 'GET, POST, OPTIONS');
    return sendJson(res, 405, { ok: false, error: 'Use GET for the manifest or POST to call a tool.' });
  }
  if (!allow(`tools:${clientIp(req)}`, PER_MINUTE, 60_000)) return sendJson(res, 429, { ok: false, error: 'Rate limit: please slow down.' });
  let body: { tool?: unknown; arguments?: unknown };
  try {
    body = (await readJson(req)) as typeof body;
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Body must be JSON: {"tool": "...", "arguments": {...}}.' });
  }
  if (typeof body?.tool !== 'string') return sendJson(res, 400, { ok: false, error: 'Missing "tool".' });
  const outcome = await callTool(body.tool, body.arguments ?? {}, apiKey);
  sendJson(res, outcome.ok ? 200 : 400, outcome.ok ? { ok: true, result: outcome.data } : { ok: false, error: outcome.error });
}
