// Shared by the Vercel functions in /api and by the dev server in vite.config.ts.
import { fetchTxData, fetchWalletData } from './monad.ts';

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
    const data = await fetchWalletData(address.trim(), apiKey);
    const warning =
      data.txCount === 0 && data.tokens.length === 0 ? 'No on-chain activity found for this address on Monad Testnet.' : undefined;
    return { status: 200, body: { data, warning } };
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
    return { status: 200, body: { data: await fetchTxData(txHash.trim(), apiKey) } };
  } catch (e) {
    return fail(502, e instanceof Error ? e.message : 'Unknown server error');
  }
}
