import { Activity, BarChart3, ExternalLink, Gauge, Layers, ListChecks, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import AddrLink from '@/components/AddrLink';
import { Card, ErrorNote, Stat } from '@/components/Card';
import { BarChart, HBars, toneForScore } from '@/components/Charts';
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
  scoreHistogram: { label: string; count: number }[];
  activity: { day: string; recorded: number; retracted: number }[];
  reasons: { label: string; count: number }[];
  topReported: { address: string; reporters: number; averageScore: number; lastReportedAt: string }[];
  recent: FeedEvent[];
  historyTruncated: boolean;
}

export function EventRow({ e, show = 'both' }: { e: FeedEvent; show?: 'both' | 'subject' | 'reporter' }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-3 text-sm last:border-0">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${e.kind === 'recorded' ? 'bg-brand/10 text-brand-ink' : 'bg-card2 text-ink2'}`}>
        {e.kind === 'recorded' ? 'Recorded' : 'Retracted'}
      </span>
      {show !== 'reporter' && (
        <span className="text-muted">
          about <AddrLink address={e.subject} />
        </span>
      )}
      {show !== 'subject' && (
        <span className="text-muted">
          by <AddrLink address={e.reporter} to="reporter" />
        </span>
      )}
      {e.kind === 'recorded' && (
        <span className="text-ink2">
          score <b>{e.score}</b> · {e.reasonLabel}
        </span>
      )}
      <span className="ml-auto flex items-center gap-2 text-xs text-faint">
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

export default function RegistryPage() {
  const { data, error, loading } = useApi<{ data: Overview }>('/api/registry-feed');
  const o = data?.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Registry Explorer</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
          Everything recorded in the public{' '}
          <a className="text-brand-ink underline" href={explorerAddressUrl(REGISTRY_ADDRESS)} target="_blank" rel="noreferrer">
            RiskRegistry
          </a>{' '}
          contract on Monad Testnet, rebuilt from its on-chain events. These are opinions of anonymous wallets, not verdicts.
        </p>
      </div>

      {loading && <Loading />}
      {error && <ErrorNote message={error} />}

      {o && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={Layers} label="Live signals" value={o.stats.liveSignals} hint="Signals that have not been retracted" />
            <Stat icon={ListChecks} label="Addresses reported" value={o.stats.addressesReported} />
            <Stat icon={Users} label="Active reporters" value={o.stats.activeReporters} />
            <Stat icon={Gauge} label="Average score" value={o.stats.averageScore ?? '–'} />
          </div>
          <p className="-mt-2 text-xs text-faint">
            {o.stats.totalReports} report(s) recorded in total, {o.stats.retractions} retracted.
            {o.historyTruncated && ' Showing the first 1000 events only.'}
          </p>

          {o.stats.liveSignals === 0 ? (
            <Card>
              <p className="text-sm text-muted">
                No live signals yet. Scan a wallet on the{' '}
                <Link className="text-brand-ink underline" to="/">
                  Scanner
                </Link>{' '}
                and record the first one.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Card title="Activity, last 14 days" icon={Activity}>
                <BarChart
                  title="Signals recorded per day, last 14 days"
                  bars={o.activity.map((d) => ({ label: d.day.slice(8), value: d.recorded + d.retracted }))}
                />
                <p className="mt-2 text-xs text-faint">Recordings and retractions per day (UTC). Day of month shown below each bar.</p>
              </Card>
              <Card title="Score distribution" icon={BarChart3}>
                <BarChart
                  title="Live signals by score"
                  bars={o.scoreHistogram.map((b, i) => ({ label: b.label.split('-')[0], value: b.count, tone: toneForScore(i * 10) }))}
                />
                <p className="mt-2 text-xs text-faint">Live signals by score band, in steps of ten. Green under 40, amber 40 to 69, red from 70.</p>
              </Card>
              <Card title="Reasons given" className="md:col-span-2">
                <HBars rows={o.reasons} />
              </Card>
            </div>
          )}

          {o.topReported.length > 0 && (
            <Card title="Most-reported addresses" icon={Trophy}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="text-xs text-faint">
                    <tr>
                      <th className="pb-2 font-medium">Address</th>
                      <th className="pb-2 font-medium">Reporters</th>
                      <th className="pb-2 font-medium">Average score</th>
                      <th className="pb-2 font-medium">Last report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.topReported.map((r) => (
                      <tr key={r.address} className="border-t border-line">
                        <td className="py-2.5">
                          <AddrLink address={r.address} />
                        </td>
                        <td className="py-2.5 tabular-nums">{r.reporters}</td>
                        <td className="py-2.5 tabular-nums">{r.averageScore}</td>
                        <td className="py-2.5 text-faint">{timeAgo(r.lastReportedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card title="Recent activity" icon={Activity}>
            {o.recent.length === 0 ? (
              <p className="text-sm text-muted">Nothing recorded yet.</p>
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
