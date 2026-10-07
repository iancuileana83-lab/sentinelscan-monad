import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import RiskGauge from '@/components/RiskGauge';
import RiskExplainer from '@/components/RiskExplainer';
import AnalystCard from '@/components/AnalystCard';
import RegistryPanel from '@/components/RegistryPanel';
import type { ScanSignal, ScanView } from '@/lib/viewTypes';

const severityStyle: Record<ScanSignal['severity'], string> = {
  low: 'border-ok/30 bg-ok/10 text-ok',
  medium: 'border-warn/30 bg-warn/10 text-warn',
  high: 'border-hi/30 bg-hi/10 text-hi',
  critical: 'border-bad/30 bg-bad/10 text-bad',
};

interface Props {
  view: ScanView;
  warning?: string;
  /** Show the link to the shareable address page (hidden on the address page itself). */
  linkToAddress?: boolean;
  /** Show the public-signals panel (the address page renders its own, richer one). */
  showRegistry?: boolean;
}

export default function ScanResult({ view, warning, linkToAddress = true, showRegistry = true }: Props) {
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-faint">
          <span className="flex items-center gap-2">
            <Wallet size={14} /> {view.kind}
          </span>
          {view.kind === 'wallet' && linkToAddress && (
            <Link className="normal-case text-brand-ink underline" to={`/address/${view.target}`}>
              Open address page
            </Link>
          )}
        </div>
        <p className="break-all font-mono text-sm text-ink2">{view.target}</p>
        {warning && <p className="mt-2 text-sm text-warn">{warning}</p>}
        <div className="mt-4 flex justify-center">
          <RiskGauge score={view.score} level={view.level} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {view.facts.map((f) => (
            <div key={f.label} className="rounded-lg bg-card2/50 p-3">
              <dt className="text-xs text-faint">{f.label}</dt>
              <dd className="mt-0.5 break-words text-sm font-medium text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">Signals found</h2>
        {view.signals.map((f) => (
          <div key={f.title} className={`rounded-lg border p-3 ${severityStyle[f.severity]}`}>
            <div className="text-sm font-medium">{f.title}</div>
            <p className="mt-0.5 text-sm text-ink2">{f.description}</p>
          </div>
        ))}
      </div>

      {view.kind === 'wallet' && showRegistry && <RegistryPanel subject={view.target} score={view.score} reasonCode={view.reasonCode ?? 0} />}

      {view.kind === 'wallet' && <AnalystCard address={view.target} />}

      <RiskExplainer explanation={view.explanation} type={view.kind} />
    </section>
  );
}
