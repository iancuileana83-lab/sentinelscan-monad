// What the scan endpoints return to the page. The scoring and all risk wording live on the
// server; the page only displays this. (Type-only imports are erased from the browser bundle.)
import type { RiskExplanation } from './riskExplainer.ts';

export type { RiskExplanation };

export interface ScanSignal {
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface ScanView {
  kind: 'wallet' | 'transaction';
  target: string;
  score: number;
  level: 'safe' | 'caution' | 'danger';
  signals: ScanSignal[];
  facts: { label: string; value: string }[];
  explanation: RiskExplanation;
  /** Wallet scans only: the reason code a user could record on-chain (see RiskRegistry). */
  reasonCode?: number;
}
