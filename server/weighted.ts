// Reputation-weighted view of the signals recorded about one address.
import { REASON_LABELS } from '../src/lib/registryConfig.ts';
import { explorer } from './monad.ts';
import { fetchLiveSignals } from './events.ts';
import { readRegistry } from './registry.ts';
import { reputationWeight, summarize, WEIGHT_FLOOR, type ReporterProfile, type WeightBreakdown } from './reputation.ts';

const MAX_PROFILED = 12;
const PROFILE_TTL_MS = 10 * 60_000;
const profiles = new Map<string, { at: number; value: { ageDays: number; transactions: number } }>();

async function walletHistory(address: string, apiKey: string): Promise<{ ageDays: number; transactions: number }> {
  const k = address.toLowerCase();
  const hit = profiles.get(k);
  if (hit && Date.now() - hit.at < PROFILE_TTL_MS) return hit.value;
  const reply = await explorer(
    { module: 'account', action: 'txlist', address, startblock: '0', endblock: '99999999', sort: 'asc', page: '1', offset: '100' },
    apiKey
  );
  let value = { ageDays: 0, transactions: 0 };
  if (reply.status === '1' && Array.isArray(reply.result) && reply.result.length) {
    const txs = reply.result as { timeStamp: string }[];
    value = { ageDays: Math.max(0, (Date.now() / 1000 - Number(txs[0].timeStamp)) / 86400), transactions: txs.length };
  }
  profiles.set(k, { at: Date.now(), value });
  return value;
}

export interface WeightedReporter {
  reporter: string;
  score: number;
  reasonCode: number;
  reasonLabel: string;
  reportedAt: string;
  weight: number;
  factors: WeightBreakdown & { ageDays: number; transactions: number; reportsMade: number };
  profiled: boolean;
}

export interface WeightedView {
  weightedAverage: number | null;
  plainAverage: number | null;
  effectiveReporters: number;
  weightFloor: number;
  reporters: WeightedReporter[];
  note: string;
  historyTruncated: boolean;
}

export async function readWeighted(subject: string, apiKey: string): Promise<WeightedView> {
  const { signals, truncated } = await fetchLiveSignals(apiKey);
  const sub = subject.toLowerCase();
  const forSubject = signals.filter((s) => s.subject.toLowerCase() === sub).sort((a, b) => b.reportedAt - a.reportedAt);

  const reportsMade = new Map<string, number>();
  for (const s of signals) reportsMade.set(s.reporter.toLowerCase(), (reportsMade.get(s.reporter.toLowerCase()) ?? 0) + 1);

  // Confirm each live signal against the contract itself (events only list candidates).
  const confirmed = [];
  for (const s of forSubject.slice(0, 25)) {
    const view = await readRegistry(s.subject, s.reporter);
    if (view.mine) confirmed.push({ ...s, score: view.mine.score, reasonCode: view.mine.reasonCode, reportedAt: view.mine.reportedAt });
  }

  const reporters: WeightedReporter[] = [];
  for (const [i, s] of confirmed.entries()) {
    const made = reportsMade.get(s.reporter.toLowerCase()) ?? 1;
    const profiled = i < MAX_PROFILED;
    const history = profiled ? await walletHistory(s.reporter, apiKey) : { ageDays: 0, transactions: 0 };
    const profile: ReporterProfile = { ...history, reportsMade: made };
    const w = reputationWeight(profile);
    reporters.push({
      reporter: s.reporter,
      score: s.score,
      reasonCode: s.reasonCode,
      reasonLabel: REASON_LABELS[s.reasonCode] ?? 'Other',
      reportedAt: new Date(s.reportedAt * 1000).toISOString(),
      weight: profiled ? w.weight : WEIGHT_FLOOR,
      factors: { ...w, ageDays: Math.round(history.ageDays * 10) / 10, transactions: history.transactions, reportsMade: made },
      profiled,
    });
  }
  reporters.sort((a, b) => b.weight - a.weight);

  const sum = summarize(reporters.map((r) => ({ score: r.score, weight: r.weight })));
  return {
    weightedAverage: sum.weightedAverage,
    plainAverage: sum.plainAverage,
    effectiveReporters: sum.effectiveReporters,
    weightFloor: WEIGHT_FLOOR,
    reporters,
    note:
      'Weights come from each reporter wallet\'s public history on Monad Testnet (age, activity, how many addresses they reported). ' +
      'They are a heuristic: patient attackers can age wallets, so this weakens cheap spam but does not prevent it.',
    historyTruncated: truncated,
  };
}

export interface ReporterView {
  address: string;
  weight: number;
  factors: WeightBreakdown & { ageDays: number; transactions: number; reportsMade: number };
  liveSignals: { subject: string; score: number; reasonLabel: string; reportedAt: string }[];
  explanation: string[];
  note: string;
}

export async function readReporter(address: string, apiKey: string): Promise<ReporterView> {
  const { signals } = await fetchLiveSignals(apiKey);
  const mine = signals.filter((s) => s.reporter.toLowerCase() === address.toLowerCase());
  const history = await walletHistory(address, apiKey);
  const w = reputationWeight({ ...history, reportsMade: mine.length });
  const pct = (x: number) => Math.round(x * 100);
  return {
    address,
    weight: w.weight,
    factors: { ...w, ageDays: Math.round(history.ageDays * 10) / 10, transactions: history.transactions, reportsMade: mine.length },
    liveSignals: mine
      .sort((a, b) => b.reportedAt - a.reportedAt)
      .slice(0, 50)
      .map((s) => ({ subject: s.subject, score: s.score, reasonLabel: REASON_LABELS[s.reasonCode] ?? 'Other', reportedAt: new Date(s.reportedAt * 1000).toISOString() })),
    explanation: [
      `Age: ${Math.round(history.ageDays * 10) / 10} days of history gives ${pct(w.age)}% of the age credit (full credit at 30 days).`,
      `Activity: ${history.transactions} transaction(s) seen gives ${pct(w.activity)}% of the activity credit (full credit at 50).`,
      `Restraint: ${mine.length} live signal(s) recorded gives a restraint factor of ${w.restraint} (1 up to 10 signals, then falling).`,
      `Weight = ${WEIGHT_FLOOR} + 0.9 x (0.5 x age + 0.5 x activity) x restraint = ${w.weight}.`,
    ],
    note: 'A heuristic from public wallet history. It lowers the weight of cheap spam, but patient attackers can age wallets.',
  };
}
