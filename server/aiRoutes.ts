// HTTP layer for the AI endpoints (shared by the Vercel functions and the dev server).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { runAgent } from './agent.ts';
import { runAnalyst } from './analyst.ts';
import { admit, cached, LIMITS, remainingToday, remember } from './aiGuard.ts';
import { guardQuote } from './guard.ts';
import { clientIp, readJson, sendJson, setCors } from './http.ts';
import { llmConfig, openAiCompatible, type Env } from './llm.ts';
import { readRegistry } from './registry.ts';
import { buildWalletReport } from './reports.ts';
import { callTool } from './tools.ts';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const AMOUNT = /^\d{1,4}(\.\d{1,4})?$/;

function begin(req: IncomingMessage, res: ServerResponse, methods: string): boolean {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return false;
  }
  if (!methods.split(',').includes(req.method ?? '')) {
    res.setHeader('allow', methods);
    sendJson(res, 405, { error: `Use ${methods}.` });
    return false;
  }
  return true;
}

export async function aiStatusRoute(req: IncomingMessage, res: ServerResponse, env: Env) {
  if (!begin(req, res, 'GET,OPTIONS')) return;
  const cfg = llmConfig(env);
  sendJson(res, 200, {
    data: {
      enabled: !!cfg,
      provider: cfg?.provider ?? null,
      model: cfg?.model ?? null,
      runsLeftToday: cfg ? remainingToday() : 0,
      limits: LIMITS,
    },
  });
}

async function body(req: IncomingMessage, res: ServerResponse): Promise<Record<string, unknown> | null> {
  try {
    const b = await readJson(req);
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    sendJson(res, 400, { error: 'Send a JSON body.' });
    return null;
  }
}

export async function agentDemoRoute(req: IncomingMessage, res: ServerResponse, env: Env) {
  if (!begin(req, res, 'POST,OPTIONS')) return;
  const b = await body(req, res);
  if (!b) return;
  const address = typeof b.address === 'string' ? b.address.trim() : '';
  const amountMon = typeof b.amountMon === 'string' && b.amountMon.trim() ? b.amountMon.trim() : '0.5';
  if (!ADDRESS.test(address)) return sendJson(res, 400, { error: 'Enter a valid wallet address: 0x followed by 40 hex characters.' });
  if (!AMOUNT.test(amountMon) || Number(amountMon) <= 0 || Number(amountMon) > 1000) return sendJson(res, 400, { error: 'Enter an amount between 0 and 1000 MON.' });
  if (!env.ETHERSCAN_API_KEY) return sendJson(res, 500, { error: 'Server is missing its explorer key.' });

  const key = `agent:${address.toLowerCase()}:${amountMon}`;
  const hit = cached<unknown>(key);
  if (hit) return sendJson(res, 200, { data: hit, cached: true });

  const cfg = llmConfig(env);
  if (cfg) {
    const verdict = admit(clientIp(req));
    if (!verdict.ok) return sendJson(res, verdict.status, { error: verdict.error });
  }
  try {
    const result = await runAgent({
      address,
      amountMon,
      llm: cfg ? openAiCompatible(cfg) : null,
      model: cfg ? { provider: cfg.provider, name: cfg.model } : null,
      runTool: (name, args) => callTool(name, args, env.ETHERSCAN_API_KEY),
    });
    remember(key, result);
    sendJson(res, 200, { data: result });
  } catch (e) {
    sendJson(res, 502, { error: e instanceof Error ? e.message : 'The agent failed.' });
  }
}

export async function analystRoute(req: IncomingMessage, res: ServerResponse, env: Env) {
  if (!begin(req, res, 'POST,OPTIONS')) return;
  const b = await body(req, res);
  if (!b) return;
  const address = typeof b.address === 'string' ? b.address.trim() : '';
  if (!ADDRESS.test(address)) return sendJson(res, 400, { error: 'Enter a valid wallet address: 0x followed by 40 hex characters.' });
  const cfg = llmConfig(env);
  if (!cfg) return sendJson(res, 503, { error: 'The AI analyst is switched off right now. The rule-based explanation still works.' });
  if (!env.ETHERSCAN_API_KEY) return sendJson(res, 500, { error: 'Server is missing its explorer key.' });

  const key = `analyst:${address.toLowerCase()}`;
  const hit = cached<unknown>(key);
  if (hit) return sendJson(res, 200, { data: hit, cached: true });

  const verdict = admit(clientIp(req));
  if (!verdict.ok) return sendJson(res, verdict.status, { error: verdict.error });
  try {
    const [report, registry, guard] = await Promise.all([
      buildWalletReport(address, env.ETHERSCAN_API_KEY),
      readRegistry(address).catch(() => null),
      guardQuote(address).catch(() => null),
    ]);
    const result = await runAnalyst({
      address,
      report,
      registry,
      guard: guard ? { decision: guard.decision, reporters: guard.reporters, averageScore: guard.averageScore } : null,
      llm: openAiCompatible(cfg),
      model: { provider: cfg.provider, name: cfg.model },
    });
    remember(key, result);
    sendJson(res, 200, { data: result });
  } catch (e) {
    sendJson(res, 502, { error: e instanceof Error ? e.message : 'The analyst failed.' });
  }
}
