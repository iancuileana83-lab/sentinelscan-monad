import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import AddrLink from '@/components/AddrLink';
import { Card, ErrorNote, Stat } from '@/components/Card';
import Loading from '@/components/Loading';
import { timeAgo } from '@/lib/format';
import { REGISTRY_ADDRESS, explorerAddressUrl, explorerTxUrl } from '@/lib/registryConfig';
import { useApi } from '@/lib/useApi';

export interface FeedEvent {
  kind: 'recorded' | 'retracted';
  subject: string;
  reporter: string;
  score?: number;
  reasonLabel?: string;
  time: string;
  txHash?: string;
}

interface Overview {
  stats: { liveSignals: number; addressesReported: number; activeReporters: number; totalReports: number; retractions: number; averageScore: number | null };
  scoreBands: { label: string; count: number }[];
  reasons: { label: string; count: number }[];
  topReported: { address: string; reporters: number; averageScore: number; lastReportedAt: string }[];
  recent: FeedEvent[];
  historyTruncated: boolean;
}

export function EventRow({ e, show = 'both' }: { e: FeedEvent; show?: 'both' | 'subject' | 'reporter' }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-800 py-2.5 text-sm last:border-0">
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          e.kind === 'recorded' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700/60 text-slate-300'
        }`}
      >
        {e.kind === 'recorded' ? 'Recorded' : 'Retracted'}
      </span>
      {show !== 'reporter' && (
        <span className="text-slate-400">
          about <AddrLink address={e.subject} />
        </span>
      )}
      {show !== 'subject' && (
        <span className="text-slate-400">
          by <AddrLink address={e.reporter} to="reporter" />
        </span>
      )}
      {e.kind === 'recorded' && (
        <span className="text-slate-300">
          score <b>{e.score}</b> · {e.reasonLabel}
        </span>
      )}
      <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
        {timeAgo(e.time)}
        {e.txHash && (
          <a className="inline-flex items-center gap-1 underline" href={explorerTxUrl(e.txHash)} target="_blank" rel="noreferrer" aria-label="View transaction">
            tx <ExternalLink size={11} />
          </a>
        )}
      </span>
    </li>
  );
}

function Bars({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between text-slate-300">
            <span>{r.label}</span>
            <span className="text-slate-500">{r.count}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-800">
            <div className="h-2 rounded-full bg-emerald-500/70" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function RegistryPage() {
  const { data, error, loading } = useApi<{ data: Overview }>('/api/registry-feed');
  const o = data?.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Registry Explorer</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Everything recorded in the public <a className="text-emerald-400 underline" href={explorerAddressUrl(REGISTRY_ADDRESS)} target="_blank" rel="noreferrer">RiskRegistry</a>{' '}
          contract on Monad Testnet, rebuilt from its on-chain events. These are opinions of anonymous wallets, not verdicts.
        </p>
      </div>

      {loading && <Loading />}
      {error && <ErrorNote message={error} />}

      {o && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Live signals" value={o.stats.liveSignals} hint="Signals that have not been retracted" />
            <Stat label="Addresses reported" value={o.stats.addressesReported} />
            <Stat label="Active reporters" value={o.stats.activeReporters} />
            <Stat label="Average score" value={o.stats.averageScore ?? '–'} />
          </div>
          <p className="-mt-2 text-xs text-slate-500">
            {o.stats.totalReports} report(s) recorded in total, {o.stats.retractions} retracted.
            {o.historyTruncated && ' Showing the first 1000 events only.'}
          </p>

          {o.stats.liveSignals === 0 ? (
            <Card>
              <p className="text-sm text-slate-400">
                No live signals yet. Scan a wallet on the <Link className="text-emerald-400 underline" to="/">Scanner</Link> and record the first one.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Card title="Score bands (live signals)">
                <Bars rows={o.scoreBands} />
              </Card>
              <Card title="Reasons given">
                <Bars rows={o.reasons} />
              </Card>
            </div>
          )}

          {o.topReported.length > 0 && (
            <Card title="Most-reported addresses">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="pb-2 font-medium">Address</th>
                      <th className="pb-2 font-medium">Reporters</th>
                      <th className="pb-2 font-medium">Average score</th>
                      <th className="pb-2 font-medium">Last report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.topReported.map((r) => (
                      <tr key={r.address} className="border-t border-slate-800">
                        <td className="py-2">
                          <AddrLink address={r.address} />
                        </td>
                        <td className="py-2">{r.reporters}</td>
                        <td className="py-2">{r.averageScore}</td>
                        <td className="py-2 text-slate-500">{timeAgo(r.lastReportedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card title="Recent activity">
            {o.recent.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing recorded yet.</p>
            ) : (
              <ul>
                {o.recent.map((e, i) => (
                  <EventRow key={`${e.txHash}-${i}`} e={e} />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
