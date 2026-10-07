// Reads the RiskRegistry event history through the explorer API and rebuilds who currently
// has a live signal about whom. The contract stays the source of truth: events are only used
// to list reporters, and every live signal is then confirmed with a direct contract read.
import { Interface } from 'ethers';
import { REGISTRY_ADDRESS } from '../src/lib/registryConfig.ts';
import { REGISTRY_ABI } from '../src/lib/registryAbi.ts';
import { explorer } from './monad.ts';
import { hypersyncLogs, type DecodedLog } from './hypersync.ts';

const iface = new Interface(REGISTRY_ABI);
const RECORDED = iface.getEvent('SignalRecorded')!.topicHash;
const RETRACTED = iface.getEvent('SignalRetracted')!.topicHash;
const PAGE = 1000;

export interface LiveSignal {
  subject: string;
  reporter: string;
  score: number;
  reasonCode: number;
  reportedAt: number;
}

export interface RawEvent {
  kind: 'recorded' | 'retracted';
  subject: string;
  reporter: string;
  score?: number;
  reasonCode?: number;
  time: number;
  order: number; // block * 1e6 + log index, for chronological order
  txHash?: string;
}

const key = (subject: string, reporter: string) => `${subject.toLowerCase()}:${reporter.toLowerCase()}`;

/** Replays events in order: a record sets (or overwrites) a signal, a retract removes it. */
export function applyEvents(events: RawEvent[]): LiveSignal[] {
  const live = new Map<string, LiveSignal>();
  for (const e of [...events].sort((a, b) => a.order - b.order)) {
    const k = key(e.subject, e.reporter);
    if (e.kind === 'retracted') {
      live.delete(k);
    } else {
      live.set(k, { subject: e.subject, reporter: e.reporter, score: e.score ?? 0, reasonCode: e.reasonCode ?? 0, reportedAt: e.time });
    }
  }
  return [...live.values()];
}

async function fetchEvents(topic0: string, kind: RawEvent['kind'], apiKey: string): Promise<{ events: RawEvent[]; truncated: boolean }> {
  const reply = await explorer(
    { module: 'logs', action: 'getLogs', address: REGISTRY_ADDRESS, topic0, fromBlock: '0', toBlock: 'latest', page: '1', offset: String(PAGE) },
    apiKey
  );
  if (reply.status !== '1' || !Array.isArray(reply.result)) {
    if (/no records/i.test(String(reply.message)) || /no records/i.test(String(reply.result))) return { events: [], truncated: false };
    throw new Error('Could not read the registry history.');
  }
  const logs = reply.result as { topics: string[]; data: string; timeStamp: string; blockNumber: string; logIndex: string; transactionHash: string }[];
  const events = logs.map((l) => {
    const parsed = iface.parseLog({ topics: l.topics, data: l.data })!;
    return {
      kind,
      subject: String(parsed.args.subject),
      reporter: String(parsed.args.reporter),
      score: kind === 'recorded' ? Number(parsed.args.score) : undefined,
      reasonCode: kind === 'recorded' ? Number(parsed.args.reasonCode) : undefined,
      time: Number(l.timeStamp),
      order: Number(l.blockNumber) * 1_000_000 + (Number(l.logIndex) || 0),
      txHash: l.transactionHash,
    } satisfies RawEvent;
  });
  return { events, truncated: logs.length >= PAGE };
}

let cache: { at: number; value: RegistryHistory } | null = null;
const TTL_MS = 20_000;

export interface RegistryHistory {
  events: RawEvent[]; // every record and retract, oldest first
  signals: LiveSignal[]; // who currently has a live signal about whom
  truncated: boolean;
  source: 'Envio HyperSync' | 'Etherscan API';
}

/** Turns one HyperSync log into the same event shape the explorer path produces. */
export function eventFromLog(log: DecodedLog, timestamps: Map<number, number>): RawEvent | null {
  const topic0 = log.topics[0];
  const kind = topic0 === RECORDED ? 'recorded' : topic0 === RETRACTED ? 'retracted' : null;
  if (!kind) return null;
  const parsed = iface.parseLog({ topics: log.topics, data: log.data });
  if (!parsed) return null;
  return {
    kind,
    subject: String(parsed.args.subject),
    reporter: String(parsed.args.reporter),
    score: kind === 'recorded' ? Number(parsed.args.score) : undefined,
    reasonCode: kind === 'recorded' ? Number(parsed.args.reasonCode) : undefined,
    time: timestamps.get(log.block) ?? 0,
    order: log.block * 1_000_000 + log.logIndex,
    txHash: log.txHash,
  };
}

/** The full registry history. Cached briefly. Envio HyperSync when a token is set, the explorer API otherwise or on failure. */
export async function fetchHistory(apiKey: string): Promise<RegistryHistory> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let events: RawEvent[] | null = null;
  let truncated = false;
  let source: RegistryHistory['source'] = 'Etherscan API';
  const token = process.env.ENVIO_API_TOKEN;
  if (token) {
    try {
      const { logs, timestamps } = await hypersyncLogs([RECORDED, RETRACTED], token);
      events = logs.map((l) => eventFromLog(l, timestamps)).filter((e): e is RawEvent => e !== null && e.time > 0);
      source = 'Envio HyperSync';
    } catch {
      events = null; // fall back to the explorer below
    }
  }
  if (!events) {
    const recorded = await fetchEvents(RECORDED, 'recorded', apiKey);
    const retracted = await fetchEvents(RETRACTED, 'retracted', apiKey);
    events = [...recorded.events, ...retracted.events];
    truncated = recorded.truncated || retracted.truncated;
  }
  events.sort((a, b) => a.order - b.order);
  const value: RegistryHistory = { events, signals: applyEvents(events), truncated, source };
  cache = { at: Date.now(), value };
  return value;
}

/** All live signals in the registry. */
export async function fetchLiveSignals(apiKey: string): Promise<{ signals: LiveSignal[]; truncated: boolean }> {
  const { signals, truncated } = await fetchHistory(apiKey);
  return { signals, truncated };
}
