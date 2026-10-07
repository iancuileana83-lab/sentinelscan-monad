import { Link, useParams } from 'react-router-dom';
import AddrLink from '@/components/AddrLink';
import { Card, ErrorNote, Stat } from '@/components/Card';
import CopyLink from '@/components/CopyLink';
import Loading from '@/components/Loading';
import { timeAgo } from '@/lib/format';
import { useApi } from '@/lib/useApi';
import { EventRow, type FeedEvent } from '@/pages/RegistryPage';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

interface Reporter {
  address: string;
  weight: number;
  factors: { weight: number; age: number; activity: number; restraint: number; ageDays: number; transactions: number; reportsMade: number };
  liveSignals: { subject: string; score: number; reasonLabel: string; reportedAt: string }[];
  explanation: string[];
  note: string;
}

function Meter({ label, value, detail }: { label: string; value: number; detail: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="text-sm">
      <div className="flex justify-between gap-3 text-slate-300">
        <span>{label}</span>
        <span className="text-right text-slate-500">{detail}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-800" role="meter" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-2 rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ReporterPage() {
  const { address = '' } = useParams();
  const valid = ADDRESS.test(address);
  const rep = useApi<{ data: Reporter }>(valid ? `/api/reporter?address=${address}` : null);
  const history = useApi<{ data: { events: FeedEvent[]; total: number } }>(valid ? `/api/registry-feed?reporter=${address}` : null);

  if (!valid) {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-100">Not a valid address</h1>
        <Link className="text-emerald-400 underline" to="/registry">
          Back to the registry
        </Link>
      </div>
    );
  }

  const r = rep.data?.data;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-100">Reporter</h1>
          <p className="mt-1 break-all font-mono text-sm text-slate-400">{address}</p>
          <Link className="mt-1 inline-block text-xs text-emerald-400 underline" to={`/address/${address}`}>
            Scan this wallet as an address
          </Link>
        </div>
        <CopyLink />
      </div>

      {rep.loading && <Loading />}
      {rep.error && <ErrorNote message={rep.error} />}

      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Weight" value={r.weight} hint="From 0.1 (new, silent wallet) to 1" />
            <Stat label="Wallet age" value={`${r.factors.ageDays} d`} />
            <Stat label="Transactions seen" value={r.factors.transactions} />
            <Stat label="Live signals" value={r.factors.reportsMade} />
          </div>

          <Card title="How this weight is built">
            <div className="space-y-4">
              <Meter label="Age" value={r.factors.age} detail="full credit at 30 days" />
              <Meter label="Activity" value={r.factors.activity} detail="full credit at 50 transactions" />
              <Meter label="Restraint" value={r.factors.restraint} detail="full up to 10 signals" />
            </div>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-400">
              {r.explanation.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              {r.note} The full rule is on{' '}
              <Link className="underline" to="/how-it-works">
                How it works
              </Link>
              .
            </p>
          </Card>

          <Card title="Live signals by this reporter">
            {r.liveSignals.length === 0 ? (
              <p className="text-sm text-slate-400">This wallet has no live signals in the registry.</p>
            ) : (
              <ul>
                {r.liveSignals.map((s) => (
                  <li key={s.subject} className="flex flex-wrap items-center gap-x-3 border-b border-slate-800 py-2.5 text-sm last:border-0">
                    <AddrLink address={s.subject} />
                    <span className="text-slate-300">
                      score <b>{s.score}</b> · {s.reasonLabel}
                    </span>
                    <span className="ml-auto text-xs text-slate-500">{timeAgo(s.reportedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <Card title="Everything this wallet recorded or retracted">
        {history.loading && <Loading />}
        {history.error && <ErrorNote message={history.error} />}
        {history.data &&
          (history.data.data.events.length === 0 ? (
            <p className="text-sm text-slate-400">No activity.</p>
          ) : (
            <ul>
              {history.data.data.events.map((e, i) => (
                <EventRow key={`${e.txHash}-${i}`} e={e} show="subject" />
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}
