// The read-only tool set exposed to AI agents, by MCP (/api/mcp) and by plain JSON
// (/api/agent-tools). Nothing here can sign, send or change anything on-chain.
import { readRegistry } from './registry.ts';
import { buildTxReport, buildWalletReport, NOTICE } from './reports.ts';
import { REASON_LABELS } from '../src/lib/registryConfig.ts';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: true; destructiveHint: false; idempotentHint: true; openWorldHint: true };
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

export const TOOLS: ToolDefinition[] = [
  {
    name: 'scan_wallet',
    description:
      'Score a wallet address on Monad Testnet (chain 10143) for risky-looking activity patterns. Returns a 0-100 risk signal, the individual signals with explanations, facts, and on-chain evidence (recent transaction hashes, top counterparties). A score is a signal, not a verdict: many risky-looking patterns belong to bots or system accounts. Analyzes the latest 100 transactions only. Testnet only, no real value.',
    inputSchema: {
      type: 'object',
      properties: { address: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$', description: 'Wallet address, 0x followed by 40 hex characters.' } },
      required: ['address'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: 'scan_transaction',
    description:
      'Score a single transaction on Monad Testnet (chain 10143) for risky-looking patterns (failed status, contract deployment, null-address use, large or complex transfers). Returns a 0-100 risk signal, the signals, and facts. A signal, not a verdict.',
    inputSchema: {
      type: 'object',
      properties: { hash: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$', description: 'Transaction hash, 0x followed by 64 hex characters.' } },
      required: ['hash'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: 'get_registry_signals',
    description:
      'Read the public RiskRegistry contract on Monad Testnet (0xb0C3Be753788a5962DE52db929f49df02700AFd4): how many distinct reporters have recorded a signal about an address, their average score and the time of the last report. Optionally include one reporter\'s own signal. Opinions of anonymous wallets, not proof: anyone can use many wallets.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$', description: 'The address the signals are about.' },
        reporter: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$', description: 'Optional. A reporter whose own signal should be included.' },
      },
      required: ['address'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
];

export type ToolOutcome = { ok: true; data: unknown } | { ok: false; error: string };

function badArgs(message: string): ToolOutcome {
  return { ok: false, error: message };
}

export async function callTool(name: string, args: unknown, apiKey: string | undefined): Promise<ToolOutcome> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return badArgs(`Unknown tool "${name}". Available: ${TOOLS.map((t) => t.name).join(', ')}.`);
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return badArgs('Arguments must be a JSON object.');
  const a = args as Record<string, unknown>;

  const allowed = Object.keys((tool.inputSchema.properties as Record<string, unknown>) ?? {});
  const extra = Object.keys(a).filter((k) => !allowed.includes(k));
  if (extra.length) return badArgs(`Unexpected argument(s): ${extra.join(', ')}.`);

  try {
    if (name === 'scan_wallet') {
      if (typeof a.address !== 'string' || !ADDRESS.test(a.address)) return badArgs('"address" must be 0x followed by 40 hex characters.');
      if (!apiKey) return badArgs('Server is missing its explorer key.');
      return { ok: true, data: await buildWalletReport(a.address, apiKey) };
    }
    if (name === 'scan_transaction') {
      if (typeof a.hash !== 'string' || !TX_HASH.test(a.hash)) return badArgs('"hash" must be 0x followed by 64 hex characters.');
      if (!apiKey) return badArgs('Server is missing its explorer key.');
      return { ok: true, data: await buildTxReport(a.hash, apiKey) };
    }
    if (name === 'get_registry_signals') {
      if (typeof a.address !== 'string' || !ADDRESS.test(a.address)) return badArgs('"address" must be 0x followed by 40 hex characters.');
      if (a.reporter !== undefined && (typeof a.reporter !== 'string' || !ADDRESS.test(a.reporter))) {
        return badArgs('"reporter" must be 0x followed by 40 hex characters.');
      }
      const view = await readRegistry(a.address, a.reporter as string | undefined);
      return {
        ok: true,
        data: {
          network: 'monad-testnet',
          subject: a.address,
          registry: view.contract,
          reporterCount: view.reporterCount,
          averageScore: view.reporterCount ? view.averageScore : null,
          lastReportedAt: view.lastReportedAt ? new Date(view.lastReportedAt * 1000).toISOString() : null,
          reporterSignal: view.mine
            ? { score: view.mine.score, reasonCode: view.mine.reasonCode, reasonLabel: REASON_LABELS[view.mine.reasonCode] ?? 'Other' }
            : null,
          notice: NOTICE,
        },
      };
    }
  } catch (e) {
    return badArgs(e instanceof Error ? e.message : 'Tool failed.');
  }
  return badArgs('Unhandled tool.');
}
