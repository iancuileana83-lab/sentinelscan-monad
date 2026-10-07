// Data for the Registry Explorer, address history and reporter pages. Everything is
// rebuilt from the RiskRegistry's public event history.
import { REASON_LABELS } from '../src/lib/registryConfig.ts';
import { fetchHistory, type RawEvent } from './events.ts';

export interface FeedEvent {
  kind: 'recorded' | 'retracted';
  subject: string;
  reporter: string;
  score?: number;
  reasonLabel?: string;
  time: string;
  txHash?: string;
}

const toFeed = (e: RawEvent): FeedEvent => ({
  kind: e.kind,
  subject: e.subject,
  reporter: e.reporter,
  score: e.score,
  reasonLabel: e.reasonCode === undefined ? undefined : (REASON_LABELS[e.reasonCode] ?? 'Other'),
  time: new Date(e.time * 1000).toISOString(),
  txHash: e.txHash,
});

export interface RegistryOverview {
  stats: {
    liveSignals: number;
    addressesReported: number;
    activeReporters: number;
    totalReports: number;
    retractions: number;
    averageScore: number | null;
  };
  scoreBands: { label: string; count: number }[];
  reasons: { label: string; count: number }[];
  topReported: { address: string; reporters: number; averageScore: number; lastReportedAt: string }[];
  recent: FeedEvent[];
  historyTruncated: boolean;
}

export async function registryOverview(apiKey: string): Promise<RegistryOverview> {
  const { events, signals, truncated } = await fetchHistory(apiKey);

  const subjects = new Map<string, { address: string; scores: number[]; last: number }>();
  const reporters = new Set<string>();
  const reasonCounts = new Map<string, number>();
  const bands = [
    { label: 'Low (0-39)', count: 0 },
    { label: 'Caution (40-69)', count: 0 },
    { label: 'High (70-100)', count: 0 },
  ];
  for (const s of signals) {
    const k = s.subject.toLowerCase();
    const row = subjects.get(k) ?? { address: s.subject, scores: [], last: 0 };
    row.scores.push(s.score);
    row.last = Math.max(row.last, s.reportedAt);
    subjects.set(k, row);
    reporters.add(s.reporter.toLowerCase());
    bands[s.score < 40 ? 0 : s.score < 70 ? 1 : 2].count += 1;
    const label = REASON_LABELS[s.reasonCode] ?? 'Other';
    reasonCounts.set(label, (reasonCounts.get(label) ?? 0) + 1);
  }

  const topReported = [...subjects.values()]
    .map((r) => ({
      address: r.address,
      reporters: r.scores.length,
      averageScore: Math.round(r.scores.reduce((a, b) => a + b, 0) / r.scores.length),
      last: r.last,
    }))
    .sort((a, b) => b.reporters - a.reporters || b.averageScore - a.averageScore || b.last - a.last)
    .slice(0, 10)
    .map(({ last, ...rest }) => ({ ...rest, lastReportedAt: new Date(last * 1000).toISOString() }));

  return {
    stats: {
      liveSignals: signals.length,
      addressesReported: subjects.size,
      activeReporters: reporters.size,
      totalReports: events.filter((e) => e.kind === 'recorded').length,
      retractions: events.filter((e) => e.kind === 'retracted').length,
      averageScore: signals.length ? Math.round(signals.reduce((a, s) => a + s.score, 0) / signals.length) : null,
    },
    scoreBands: bands,
    reasons: [...reasonCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    topReported,
    recent: events.slice(-20).reverse().map(toFeed),
    historyTruncated: truncated,
  };
}

/** Every event about one address, or by one reporter, newest first. */
export async function registryEvents(apiKey: string, filter: { subject?: string; reporter?: string }) {
  const { events, truncated } = await fetchHistory(apiKey);
  const sub = filter.subject?.toLowerCase();
  const rep = filter.reporter?.toLowerCase();
  const matching = events.filter((e) => (!sub || e.subject.toLowerCase() === sub) && (!rep || e.reporter.toLowerCase() === rep));
  return { events: matching.slice(-100).reverse().map(toFeed), total: matching.length, historyTruncated: truncated };
}
