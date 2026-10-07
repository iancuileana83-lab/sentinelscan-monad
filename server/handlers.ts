// Shared by the Vercel functions in /api and by the dev server in vite.config.ts.
import { buildTxReport, buildWalletReport } from './reports.ts';
import { readRegistry } from './registry.ts';
import { readReporter, readWeighted } from './weighted.ts';
import { registryEvents, registryOverview } from './registryFeed.ts';
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

export async function registryView(subject: unknown, reporter: unknown, apiKey?: string): Promise<HandlerResult> {
  if (typeof subject !== 'string' || !ADDRESS.test(subject.trim())) {
    return fail(400, 'Enter a valid wallet address: 0x followed by 40 hex characters.');
  }
  const who = typeof reporter === 'string' && ADDRESS.test(reporter.trim()) ? reporter.trim() : undefined;
  try {
    const data = await readRegistry(subject.trim(), who);
    // The weighted view needs the explorer key; if it fails, the plain on-chain numbers still show.
    let weighted;
    let weightedError: string | undefined;
    if (apiKey && data.reporterCount > 0) {
      try {
        weighted = await readWeighted(subject.trim(), apiKey);
      } catch (e) {
        weightedError = e instanceof Error ? e.message : 'Weighted view unavailable.';
      }
    }
    return { status: 200, body: { data, weighted, weightedError } };
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

export async function registryFeed(subject: unknown, reporter: unknown, apiKey: string | undefined): Promise<HandlerResult> {
  if (!apiKey) return fail(500, 'Server is missing its explorer key (ETHERSCAN_API_KEY).');
  try {
    const s = typeof subject === 'string' && subject ? subject.trim() : undefined;
    const r = typeof reporter === 'string' && reporter ? reporter.trim() : undefined;
    if ((s && !ADDRESS.test(s)) || (r && !ADDRESS.test(r))) return fail(400, 'Enter a valid address: 0x followed by 40 hex characters.');
    if (s || r) return { status: 200, body: { data: await registryEvents(apiKey, { subject: s, reporter: r }) } };
    return { status: 200, body: { data: await registryOverview(apiKey) } };
  } catch (e) {
    return fail(502, e instanceof Error ? e.message : 'Unknown server error');
  }
}

export async function reporterView(address: unknown, apiKey: string | undefined): Promise<HandlerResult> {
  if (typeof address !== 'string' || !ADDRESS.test(address.trim())) return fail(400, 'Enter a valid wallet address: 0x followed by 40 hex characters.');
  if (!apiKey) return fail(500, 'Server is missing its explorer key (ETHERSCAN_API_KEY).');
  try {
    return { status: 200, body: { data: await readReporter(address.trim(), apiKey) } };
  } catch (e) {
    return fail(502, e instanceof Error ? e.message : 'Unknown server error');
  }
}
