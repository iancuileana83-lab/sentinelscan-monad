// Registry events through Envio HyperSync, a fast indexed query API for chain data. Used when
// ENVIO_API_TOKEN is set; the Etherscan API stays as the fallback so the app never depends on it.
import { REGISTRY_ADDRESS } from '../src/lib/registryConfig.ts';
import type { RawEvent } from './events.ts';

const URL_QUERY = 'https://monad-testnet.hypersync.xyz/query';
const MAX_PAGES = 20;

interface HsLog {
  address?: string;
  data?: string;
  topic0?: string | null;
  topic1?: string | null;
  topic2?: string | null;
  topic3?: string | null;
  topics?: (string | null)[];
  block_number?: number | string;
  blockNumber?: number | string;
  transaction_hash?: string;
  transactionHash?: string;
  log_index?: number | string;
  logIndex?: number | string;
}

interface HsBlock {
  number?: number | string;
  timestamp?: number | string;
}

export interface HsPage {
  data?: { logs?: HsLog[]; blocks?: HsBlock[] }[];
  next_block?: number;
  archive_height?: number;
}

const num = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return v.startsWith('0x') ? parseInt(v, 16) : Number(v);
  return 0;
};

/** One decoded log: topics, data and where it happened, tolerant of either field naming style. */
export interface DecodedLog {
  topics: string[];
  data: string;
  block: number;
  logIndex: number;
  txHash: string;
}

export function readPage(page: HsPage): { logs: DecodedLog[]; timestamps: Map<number, number> } {
  const logs: DecodedLog[] = [];
  const timestamps = new Map<number, number>();
  for (const chunk of page.data ?? []) {
    for (const b of chunk.blocks ?? []) timestamps.set(num(b.number), num(b.timestamp));
    for (const l of chunk.logs ?? []) {
      const topics = (l.topics ?? [l.topic0, l.topic1, l.topic2, l.topic3]).filter((t): t is string => typeof t === 'string' && t.length > 2);
      logs.push({
        topics,
        data: l.data ?? '0x',
        block: num(l.block_number ?? l.blockNumber),
        logIndex: num(l.log_index ?? l.logIndex),
        txHash: l.transaction_hash ?? l.transactionHash ?? '',
      });
    }
  }
  return { logs, timestamps };
}

/** Every log of the registry whose first topic is one of `topic0s`, oldest first. */
export async function hypersyncLogs(topic0s: string[], token: string): Promise<{ logs: DecodedLog[]; timestamps: Map<number, number> }> {
  const logs: DecodedLog[] = [];
  const timestamps = new Map<number, number>();
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(URL_QUERY, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        from_block: from,
        logs: [{ address: [REGISTRY_ADDRESS], topics: [topic0s] }],
        field_selection: {
          block: ['number', 'timestamp'],
          log: ['address', 'data', 'topic0', 'topic1', 'topic2', 'topic3', 'block_number', 'transaction_hash', 'log_index'],
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HyperSync returned ${res.status}`);
    const body = (await res.json()) as HsPage;
    const got = readPage(body);
    logs.push(...got.logs);
    got.timestamps.forEach((t, n) => timestamps.set(n, t));
    const next = body.next_block ?? 0;
    if (!next || next <= from || (body.archive_height !== undefined && next > body.archive_height)) break;
    from = next;
  }
  return { logs, timestamps };
}

/** The chain height HyperSync has indexed (it tracks the head in real time). */
export async function hypersyncHeight(token: string): Promise<number> {
  const res = await fetch('https://monad-testnet.hypersync.xyz/height', { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HyperSync returned ${res.status}`);
  return Number(((await res.json()) as { height?: number }).height ?? 0);
}

export interface HsRawBlock {
  number: string;
  timestamp: string;
  gasUsed: string;
  transactions: { hash: string; from: string; to: string | null; value: string }[];
}

interface HsTx {
  hash?: string;
  from?: string;
  to?: string | null;
  value?: string;
  block_number?: number | string;
}
interface HsBlk {
  number?: number | string;
  timestamp?: number | string;
  gas_used?: number | string;
}

/** Blocks from `from` up to and including `to`, with all their transactions, in the same shape the RPC returns. */
export async function hypersyncBlocks(from: number, to: number, token: string): Promise<HsRawBlock[]> {
  const blocks = new Map<number, HsRawBlock>();
  let cursor = from;
  for (let page = 0; page < 4 && cursor <= to; page++) {
    const res = await fetch(URL_QUERY, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        from_block: cursor,
        to_block: to + 1,
        transactions: [{}],
        field_selection: { block: ['number', 'timestamp', 'gas_used'], transaction: ['hash', 'from', 'to', 'value', 'block_number'] },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HyperSync returned ${res.status}`);
    const body = (await res.json()) as { data?: { blocks?: HsBlk[]; transactions?: HsTx[] }[]; next_block?: number };
    for (const chunk of body.data ?? []) {
      for (const b of chunk.blocks ?? []) {
        const n = num(b.number);
        if (!blocks.has(n)) blocks.set(n, { number: '0x' + n.toString(16), timestamp: '0x' + num(b.timestamp).toString(16), gasUsed: '0x' + num(b.gas_used).toString(16), transactions: [] });
      }
      for (const t of chunk.transactions ?? []) {
        const blk = blocks.get(num(t.block_number));
        if (blk && t.hash && t.from) blk.transactions.push({ hash: t.hash, from: t.from, to: t.to ?? null, value: t.value ?? '0x0' });
      }
    }
    const next = body.next_block ?? 0;
    if (!next || next <= cursor) break;
    cursor = next;
  }
  return [...blocks.values()].sort((a, b) => parseInt(a.number, 16) - parseInt(b.number, 16));
}

export type { RawEvent };
