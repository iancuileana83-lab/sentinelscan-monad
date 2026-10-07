import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import RiskGauge from '@/components/RiskGauge';
import RiskExplainer from '@/components/RiskExplainer';
import RegistryPanel from '@/components/RegistryPanel';
import type { ScanSignal, ScanView } from '@/lib/viewTypes';

const severityStyle: Record<ScanSignal['severity'], string> = {
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  critical: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
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
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-slate-500">
          <span className="flex items-center gap-2">
            <Wallet size={14} /> {view.kind}
          </span>
          {view.kind === 'wallet' && linkToAddress && (
            <Link className="normal-case text-emerald-400 underline" to={`/address/${view.target}`}>
              Open address page
            </Link>
          )}
        </div>
        <p className="break-all font-mono text-sm text-slate-300">{view.target}</p>
        {warning && <p className="mt-2 text-sm text-amber-300">{warning}</p>}
        <div className="mt-4 flex justify-center">
          <RiskGauge score={view.score} level={view.level} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {view.facts.map((f) => (
            <div key={f.label} className="rounded-lg bg-slate-800/50 p-3">
              <dt className="text-xs text-slate-500">{f.label}</dt>
              <dd className="mt-0.5 break-words text-sm font-medium text-slate-200">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-100">Signals found</h2>
        {view.signals.map((f) => (
          <div key={f.title} className={`rounded-lg border p-3 ${severityStyle[f.severity]}`}>
            <div className="text-sm font-medium">{f.title}</div>
            <p className="mt-0.5 text-sm text-slate-300">{f.description}</p>
          </div>
        ))}
      </div>

      {view.kind === 'wallet' && showRegistry && <RegistryPanel subject={view.target} score={view.score} reasonCode={view.reasonCode ?? 0} />}

      <RiskExplainer explanation={view.explanation} type={view.kind} />
    </section>
  );
}
