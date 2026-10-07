// Server-side data fetching for Monad Testnet. Runs only in the backend so the
// Etherscan key never reaches the browser. Chain: Monad Testnet, chain ID 10143.
import type { WalletData } from '../src/lib/walletRisk.ts';
import type { TxData } from '../src/lib/txRisk.ts';

export const CHAIN_ID = 10143;
export const NETWORK = 'monad-testnet';
const EXPLORER_API = 'https://api.etherscan.io/v2/api';

// The first two answer fast; the main public RPC sometimes stalls on some calls.
const PUBLIC_RPC_URLS = ['https://rpc-testnet.monadinfra.com', 'https://rpc.ankr.com/monad_testnet', 'https://testnet-rpc.monad.xyz'];

/** Envio HyperRPC goes first when a free Envio token is configured; the public endpoints remain the fallback. */
function rpcUrls(): string[] {
  const token = process.env.ENVIO_API_TOKEN;
  return token ? [`https://monad-testnet.rpc.hypersync.xyz/${token}`, ...PUBLIC_RPC_URLS] : PUBLIC_RPC_URLS;
}

export const upstreamName = () => (process.env.ENVIO_API_TOKEN ? 'Envio HyperRPC' : 'public Monad RPC');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function rpc<T = unknown>(method: string, params: unknown[], urls = rpcUrls()): Promise<T> {
  let lastError = 'no RPC answered';
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      const body = (await res.json()) as { result?: T; error?: { message: string } };
      if (body.error) {
        lastError = body.error.message;
        continue;
      }
      return body.result as T;
    } catch (e) {
      lastError = e instanceof Error ? e.name : 'RPC error';
    }
  }
  throw new Error(`Monad Testnet RPC unavailable (${lastError}). Please try again.`);
}

/** Several calls in one request. Falls back to single calls when an endpoint does not do batches. */
export async function rpcBatch<T = unknown>(calls: { method: string; params: unknown[] }[]): Promise<(T | null)[]> {
  if (calls.length === 0) return [];
  const urls = rpcUrls();
  // Ankr and HyperRPC answer batches; the foundation endpoint does not.
  const ordered = [...urls.filter((u) => !u.includes('monadinfra')), ...urls.filter((u) => u.includes('monadinfra'))];
  for (const url of ordered) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: '2.0', id: i, method: c.method, params: c.params }))),
        signal: AbortSignal.timeout(8000),
      });
      const body = (await res.json()) as { id: number; result?: T }[];
      if (!Array.isArray(body)) continue;
      const out: (T | null)[] = calls.map(() => null);
      for (const r of body) if (typeof r.id === 'number' && r.id < out.length) out[r.id] = r.result ?? null;
      return out;
    } catch {
      // try the next endpoint
    }
  }
  const out: (T | null)[] = [];
  for (const c of calls) out.push(await rpc<T>(c.method, c.params).catch(() => null));
  return out;
}

interface ExplorerReply {
  status: string;
  message: string;
  result: unknown;
}

// Etherscan's free plan allows only a few calls per second, so calls are made one
// after another and retried briefly when the limit is hit.
export async function explorer(params: Record<string, string>, apiKey: string): Promise<ExplorerReply> {
  const query = new URLSearchParams({ chainid: String(CHAIN_ID), ...params, apikey: apiKey });
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${EXPLORER_API}?${query}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Explorer API returned ${res.status}`);
    const body = (await res.json()) as ExplorerReply;
    if (body.status === '0' && /rate limit/i.test(String(body.result))) {
      await sleep(600 * (attempt + 1));
      continue;
    }
    return body;
  }
  throw new Error('Explorer API is busy. Please try again in a moment.');
}

const NOT_FOUND = /no (transactions|records|internal)/i;

export async function fetchWalletData(address: string, apiKey: string): Promise<WalletData & { balanceWei: string }> {
  const list = await explorer(
    { module: 'account', action: 'txlist', address, startblock: '0', endblock: '99999999', sort: 'desc', page: '1', offset: '100' },
    apiKey
  );
  let transactions: WalletData['transactions'] = [];
  if (list.status === '1' && Array.isArray(list.result)) {
    transactions = list.result as WalletData['transactions'];
  } else if (!NOT_FOUND.test(String(list.message)) && !NOT_FOUND.test(String(list.result))) {
    throw new Error('Explorer API error. Please try again.');
  }

  const tokenReply = await explorer(
    { module: 'account', action: 'tokentx', address, startblock: '0', endblock: '99999999', sort: 'desc', page: '1', offset: '100' },
    apiKey
  );
  const tokens: WalletData['tokens'] = [];
  if (tokenReply.status === '1' && Array.isArray(tokenReply.result)) {
    const seen = new Set<string>();
    for (const t of tokenReply.result as Record<string, string>[]) {
      if (seen.has(t.contractAddress)) continue;
      seen.add(t.contractAddress);
      tokens.push({
        contractAddress: t.contractAddress,
        name: t.tokenName || 'Unknown',
        symbol: t.tokenSymbol || '???',
        balance: t.value,
        decimals: t.tokenDecimal || '18',
      });
    }
  }

  const balanceReply = await explorer({ module: 'account', action: 'balance', address, tag: 'latest' }, apiKey);
  const balanceWei = balanceReply.status === '1' ? String(balanceReply.result) : '0';

  const me = address.toLowerCase();
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    const other = tx.from.toLowerCase() === me ? tx.to : tx.from;
    if (other) counts.set(other, (counts.get(other) || 0) + 1);
  }
  const contractInteractions = [...counts.entries()]
    .map(([addr, count]) => ({ address: addr, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const sorted = [...transactions].sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp));
  return {
    address,
    network: NETWORK,
    txCount: transactions.length,
    tokenCount: tokens.length,
    transactions: sorted.slice(0, 20),
    tokens: tokens.slice(0, 20),
    contractInteractions,
    firstSeen: sorted.length ? new Date(Number(sorted[sorted.length - 1].timeStamp) * 1000).toISOString() : undefined,
    lastActive: sorted.length ? new Date(Number(sorted[0].timeStamp) * 1000).toISOString() : undefined,
    balanceWei,
  };
}

interface RpcTx {
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice?: string;
  input: string;
  blockNumber: string | null;
}
interface RpcReceipt {
  status?: string;
  gasUsed?: string;
}

export async function fetchTxData(txHash: string, apiKey: string): Promise<TxData> {
  const tx = await rpc<RpcTx | null>('eth_getTransactionByHash', [txHash]);
  if (!tx) throw new Error('Transaction not found on Monad Testnet. The hash may be wrong or from another network.');

  const receipt = await rpc<RpcReceipt | null>('eth_getTransactionReceipt', [txHash]);
  const receiptStatus = receipt?.status ?? null;
  const gasUsed = parseInt(receipt?.gasUsed ?? '0x0', 16).toString();

  let timeStamp = '';
  if (tx.blockNumber) {
    const block = await rpc<{ timestamp?: string } | null>('eth_getBlockByNumber', [tx.blockNumber, false]);
    if (block?.timestamp) timeStamp = parseInt(block.timestamp, 16).toString();
  }

  const tokenReply = await explorer(
    { module: 'account', action: 'tokentx', txhash: txHash, startblock: '0', endblock: '99999999', sort: 'asc' },
    apiKey
  );
  const tokenTransfers: TxData['tokenTransfers'] =
    tokenReply.status === '1' && Array.isArray(tokenReply.result)
      ? (tokenReply.result as Record<string, string>[]).map((t) => ({
          from: t.from || '',
          to: t.to || '',
          value: t.value || '0',
          tokenName: t.tokenName || 'Unknown',
          tokenSymbol: t.tokenSymbol || '???',
          tokenDecimal: t.tokenDecimal || '18',
          contractAddress: t.contractAddress || '',
        }))
      : [];

  const internalReply = await explorer(
    { module: 'account', action: 'txlistinternal', txhash: txHash, startblock: '0', endblock: '99999999', sort: 'asc' },
    apiKey
  );
  const internalTxs: TxData['internalTxs'] =
    internalReply.status === '1' && Array.isArray(internalReply.result)
      ? (internalReply.result as Record<string, string>[]).map((t) => ({
          from: t.from || '',
          to: t.to || '',
          value: t.value || '0',
          type: t.type || 'call',
          input: t.input || undefined,
        }))
      : [];

  const input = tx.input ?? '0x';
  return {
    hash: txHash,
    network: NETWORK,
    blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : 0,
    timeStamp,
    from: tx.from ?? '',
    to: tx.to ?? '',
    value: BigInt(tx.value ?? '0x0').toString(),
    gas: parseInt(tx.gas ?? '0x0', 16).toString(),
    gasPrice: parseInt(tx.gasPrice ?? '0x0', 16).toString(),
    gasUsed,
    isSuccess: receiptStatus === '0x1',
    contractAddress: tx.to === null ? txHash : null,
    functionName: input.length >= 10 ? input.slice(0, 10) : null,
    input,
    tokenTransfers,
    internalTxs,
    receiptStatus,
  };
}
