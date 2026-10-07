// Shared by the Vercel functions in /api and by the dev server in vite.config.ts.
import { buildTxReport, buildWalletReport } from './reports.ts';
import { readRegistry } from './registry.ts';
import { txView, walletView } from './views.ts';

export interface HandlerResult {
  status: number;
  body: unknown;
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

function fail(status: number, error: string): HandlerResult {
  return { status, body: { error } };
}

export async function walletScan(address: unknown, apiKey: string | undefined): Promise<HandlerResult> {
  if (typeof address !== 'string' || !ADDRESS.test(address.trim())) {
    return fail(400, 'Enter a valid wallet address: 0x followed by 40 hex characters.');
  }
  if (!apiKey) return fail(500, 'Server is missing its explorer key (ETHERSCAN_API_KEY).');
  try {
    const report = await buildWalletReport(address.trim(), apiKey);
    const empty = report.facts.transactionsAnalyzed === 0 && report.evidence.tokens.length === 0;
    const warning = empty ? 'No on-chain activity found for this address on Monad Testnet.' : undefined;
    return { status: 200, body: { data: walletView(report), warning } };
  } catch (e) {
    return fail(502, e instanceof Error ? e.message : 'Unknown server error');
  }
}

export async function registryView(subject: unknown, reporter: unknown): Promise<HandlerResult> {
  if (typeof subject !== 'string' || !ADDRESS.test(subject.trim())) {
    return fail(400, 'Enter a valid wallet address: 0x followed by 40 hex characters.');
  }
  const who = typeof reporter === 'string' && ADDRESS.test(reporter.trim()) ? reporter.trim() : undefined;
  try {
    return { status: 200, body: { data: await readRegistry(subject.trim(), who) } };
  } catch (e) {
    return fail(502, e instanceof Error ? e.message : 'Unknown server error');
  }
}

export async function txScan(txHash: unknown, apiKey: string | undefined): Promise<HandlerResult> {
  if (typeof txHash !== 'string' || !TX_HASH.test(txHash.trim())) {
    return fail(400, 'Enter a valid transaction hash: 0x followed by 64 hex characters.');
  }
  if (!apiKey) return fail(500, 'Server is missing its explorer key (ETHERSCAN_API_KEY).');
  try {
    return { status: 200, body: { data: txView(await buildTxReport(txHash.trim(), apiKey)) } };
  } catch (e) {
    return fail(502, e instanceof Error ? e.message : 'Unknown server error');
  }
}
