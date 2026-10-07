// The live risk radar: follows new Monad Testnet blocks and flags transactions with simple checks that
// need only the block itself (no explorer history), plus one lookup against the public RiskRegistry.
// These are hints for a quick look, never verdicts.
import { GUARD_POLICY } from '../src/lib/registryConfig.ts';
import { fetchHistory } from './events.ts';
import { hypersyncBlocks, hypersyncHeight } from './hypersync.ts';
import { rpc, rpcBatch, upstreamName } from './monad.ts';
import { weiToMon } from './safe.ts';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const LARGE_VALUE_WEI = 100n * 10n ** 18n;
const MAX_BLOCKS_PER_CALL = 16;
const MAX_HITS_PER_BLOCK = 8;

export interface RadarHit {
  hash: string;
  from: string;
  to: string;
  valueMON: string;
  level: 'high' | 'medium';
  reasons: string[];
}

export interface RadarBlock {
  n: number;
  t: number; // unix seconds
  tx: number;
  gas: number;
  deployments: number;
  hits: RadarHit[];
}

export interface FlaggedAddress {
  reporters: number;
  averageScore: number;
}

export interface RawTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
}

/** Reasons a transaction is worth a glance. Empty means nothing to flag. */
export function classifyTx(tx: RawTx, flagged: Map<string, FlaggedAddress>): { level: 'high' | 'medium'; reasons: string[] } | null {
  const reasons: string[] = [];
  let level: 'high' | 'medium' = 'medium';
  const to = tx.to?.toLowerCase() ?? null;

  if (to) {
    const f = flagged.get(to);
    if (f && f.averageScore >= GUARD_POLICY.confirmScore) {
      reasons.push(`Pays an address with ${f.reporters} live public signal(s), average score ${f.averageScore}`);
      if (f.averageScore >= GUARD_POLICY.blockScore && f.reporters >= GUARD_POLICY.minReportersToBlock) level = 'high';
    }
    if (to === NULL_ADDRESS) {
      reasons.push('Sent to the null address (0x000…000)');
      level = 'high';
    }
    if (to === tx.from.toLowerCase()) reasons.push('Sender and receiver are the same address');
  }
  let value = 0n;
  try {
    value = BigInt(tx.value || '0x0');
  } catch {
    value = 0n;
  }
  if (value >= LARGE_VALUE_WEI) reasons.push(`Large transfer of ${weiToMon(value, 2)} MON`);
  return reasons.length ? { level, reasons } : null;
}

interface RawBlock {
  number: string;
  timestamp: string;
  gasUsed: string;
  transactions: RawTx[];
}

export function summarizeBlock(block: RawBlock, flagged: Map<string, FlaggedAddress>): RadarBlock {
  const hits: RadarHit[] = [];
  let deployments = 0;
  for (const tx of block.transactions) {
    if (tx.to === null) deployments += 1;
    const c = classifyTx(tx, flagged);
    if (c && hits.length < MAX_HITS_PER_BLOCK) {
      hits.push({ hash: tx.hash, from: tx.from, to: tx.to ?? '', valueMON: weiToMon(tx.value, 4), level: c.level, reasons: c.reasons });
    }
  }
  return {
    n: parseInt(block.number, 16),
    t: parseInt(block.timestamp, 16),
    tx: block.transactions.length,
    gas: parseInt(block.gasUsed, 16),
    deployments,
    hits,
  };
}

// Blocks that have already been summarized, shared by every visitor on this server instance.
const seen = new Map<number, RadarBlock>();

async function flaggedAddresses(apiKey: string | undefined): Promise<{ map: Map<string, FlaggedAddress>; ok: boolean }> {
  const map = new Map<string, FlaggedAddress>();
  if (!apiKey) return { map, ok: false };
  try {
    const { signals } = await fetchHistory(apiKey);
    const rows = new Map<string, number[]>();
    for (const s of signals) rows.set(s.subject.toLowerCase(), [...(rows.get(s.subject.toLowerCase()) ?? []), s.score]);
    for (const [addr, scores] of rows) map.set(addr, { reporters: scores.length, averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) });
    return { map, ok: true };
  } catch {
    return { map, ok: false };
  }
}

export async function radarSince(after: number, apiKey: string | undefined) {
  const token = process.env.ENVIO_API_TOKEN;
  let head = 0;
  let upstream = upstreamName();
  let viaHypersync = false;
  if (token) {
    try {
      head = await hypersyncHeight(token);
      viaHypersync = head > 0;
      if (viaHypersync) upstream = 'Envio HyperSync';
    } catch {
      viaHypersync = false;
    }
  }
  if (!viaHypersync) head = parseInt(await rpc<string>('eth_blockNumber', []), 16);
  const from = after > 0 && head - after <= MAX_BLOCKS_PER_CALL ? after + 1 : head - 5;
  const start = Math.max(from, head - MAX_BLOCKS_PER_CALL + 1);
  const { map, ok } = await flaggedAddresses(apiKey);

  const wanted: number[] = [];
  for (let n = start; n <= head; n++) if (!seen.has(n)) wanted.push(n);
  let raw: (RawBlock | null)[] = [];
  if (wanted.length && viaHypersync && token) {
    try {
      raw = await hypersyncBlocks(wanted[0], wanted[wanted.length - 1], token);
    } catch {
      viaHypersync = false;
      upstream = upstreamName();
    }
  }
  if (wanted.length && !viaHypersync) {
    raw = await rpcBatch<RawBlock>(wanted.map((n) => ({ method: 'eth_getBlockByNumber', params: ['0x' + n.toString(16), true] })));
  }
  raw.forEach((b) => {
    if (b) seen.set(parseInt(b.number, 16), summarizeBlock(b, map));
  });
  if (seen.size > 400) for (const k of [...seen.keys()].sort((a, b) => a - b).slice(0, seen.size - 300)) seen.delete(k);

  const blocks: RadarBlock[] = [];
  for (let n = start; n <= head; n++) {
    const b = seen.get(n);
    if (b) blocks.push(b);
  }
  return {
    head,
    blocks,
    flaggedAddresses: map.size,
    registryAvailable: ok,
    upstream,
  };
}
