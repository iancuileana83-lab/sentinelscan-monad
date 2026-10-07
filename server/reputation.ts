// Off-chain reputation weighting of RiskRegistry signals. The contract is unchanged: it stores
// one equal-weight signal per reporter. Here each reporter's signal is weighted by what their
// wallet's public history says about how costly and how careful they are:
//
//   - age:      weeks of history are hard to fake at the last minute (full credit at 30 days);
//   - activity: a wallet that actually uses the network (full credit at 50 transactions);
//   - restraint: reporters who spray signals at many addresses count for less.
//
// A brand-new, silent wallet still counts, but at the floor weight. Sybil attacks stay possible
// (patient attackers can age wallets), so this makes cheap spam weaker; it does not make it
// impossible. All numbers below are the whole formula.

export const WEIGHT_FLOOR = 0.1;
export const FULL_AGE_DAYS = 30;
export const FULL_ACTIVITY_TXS = 50;
export const SPAM_FREE_REPORTS = 10;

export interface ReporterProfile {
  ageDays: number; // days since the reporter's first transaction (0 if none)
  transactions: number; // transactions seen (capped by the explorer page size)
  reportsMade: number; // live signals this reporter has recorded across all addresses
}

export interface WeightBreakdown {
  weight: number;
  age: number;
  activity: number;
  restraint: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

export function reputationWeight(p: ReporterProfile): WeightBreakdown {
  const age = clamp01(p.ageDays / FULL_AGE_DAYS);
  const activity = clamp01(Math.log10(1 + Math.max(0, p.transactions)) / Math.log10(1 + FULL_ACTIVITY_TXS));
  const restraint = p.reportsMade <= SPAM_FREE_REPORTS ? 1 : clamp01(SPAM_FREE_REPORTS / p.reportsMade);
  const earned = (0.5 * age + 0.5 * activity) * Math.max(restraint, 0.2);
  return { weight: round(WEIGHT_FLOOR + (1 - WEIGHT_FLOOR) * earned), age: round(age), activity: round(activity), restraint: round(restraint) };
}

export interface WeightedSignal {
  score: number;
  weight: number;
}

export interface WeightedSummary {
  weightedAverage: number | null;
  plainAverage: number | null;
  effectiveReporters: number; // Kish effective sample size: 1 reporter = 1, many equal weights = n
  totalWeight: number;
}

export function summarize(signals: WeightedSignal[]): WeightedSummary {
  if (signals.length === 0) return { weightedAverage: null, plainAverage: null, effectiveReporters: 0, totalWeight: 0 };
  const total = signals.reduce((a, s) => a + s.weight, 0);
  const sumSq = signals.reduce((a, s) => a + s.weight * s.weight, 0);
  const weighted = signals.reduce((a, s) => a + s.weight * s.score, 0) / total;
  const plain = signals.reduce((a, s) => a + s.score, 0) / signals.length;
  return {
    weightedAverage: Math.round(weighted),
    plainAverage: Math.round(plain),
    effectiveReporters: round((total * total) / sumSq, 2),
    totalWeight: round(total, 2),
  };
}
