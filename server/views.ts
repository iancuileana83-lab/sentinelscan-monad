// Turns the structured reports into what the web page displays.
import type { ScanView } from '../src/lib/viewTypes.ts';
import type { TxReport, WalletReport } from './reports.ts';

const day = (iso: unknown) => (typeof iso === 'string' ? iso.slice(0, 10) : 'n/a');

export function walletView(r: WalletReport): ScanView {
  return {
    kind: 'wallet',
    target: r.address,
    score: r.riskSignal.score,
    level: r.riskSignal.level as ScanView['level'],
    signals: r.signals,
    facts: [
      { label: 'Balance', value: `${r.facts.balanceMON} MON` },
      { label: 'Transactions (latest 100)', value: String(r.facts.transactionsAnalyzed) },
      { label: 'Tokens seen', value: String(r.facts.tokensSeen) },
      { label: 'First seen', value: day(r.facts.firstSeen) },
    ],
    explanation: r.explanation,
    reasonCode: r.riskSignal.reasonCode,
  };
}

export function txView(r: TxReport): ScanView {
  return {
    kind: 'transaction',
    target: r.hash,
    score: r.riskSignal.score,
    level: r.riskSignal.level as ScanView['level'],
    signals: r.signals,
    facts: [
      { label: 'Status', value: r.facts.status === 'success' ? 'Success' : 'Failed' },
      { label: 'Value', value: `${r.facts.valueMON} MON` },
      { label: 'Block', value: String(r.facts.block) },
      { label: 'Token transfers', value: String(r.facts.tokenTransfers) },
    ],
    explanation: r.explanation,
  };
}
