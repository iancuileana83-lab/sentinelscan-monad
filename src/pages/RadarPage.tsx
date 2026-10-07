import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Blocks, Check, Copy, ExternalLink, Gauge, Pause, Play, Radar, Zap } from 'lucide-react';
import AddrLink from '@/components/AddrLink';
import { Card, ErrorNote, Stat } from '@/components/Card';
import { DEMO_TARGET, MONAD_TESTNET, explorerTxUrl } from '@/lib/registryConfig';

interface Hit {
  hash: string;
  from: string;
  to: string;
  valueMON: string;
  level: 'high' | 'medium';
  reasons: string[];
  block?: number;
}

interface Block {
  n: number;
  t: number;
  tx: number;
  gas: number;
  deployments: number;
  hits: Hit[];
}

interface RadarReply {
  head: number;
  blocks: Block[];
  flaggedAddresses: number;
  registryAvailable: boolean;
  upstream: string;
}

const POLL_MS = 1800;
const KEEP_BLOCKS = 40;
const KEEP_HITS = 24;

const RULES = [
  'Pays an address that has live public signals in the registry (average 40 or more)',
  'Sent to the null address',
  'Sender and receiver are the same address',
  'Transfer of 100 MON or more',
];

function Spark({ blocks }: { blocks: Block[] }) {
  const recent = [...blocks].reverse().slice(-KEEP_BLOCKS);
  const max = Math.max(1, ...recent.map((b) => b.tx));
  return (
    <div className="flex h-16 items-end gap-0.5" role="img" aria-label={`Transactions in the last ${recent.length} blocks`}>
      {recent.map((b) => (
        <div
          key={b.n}
          title={`Block ${b.n}: ${b.tx} transaction(s)`}
          className={`min-w-[3px] flex-1 rounded-t-sm ${b.hits.length ? 'bg-warn' : 'bg-brand/70'}`}
          style={{ height: `${Math.max(6, (b.tx / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function RadarPage() {
  const [blocks, setBlocks] = useState<Block[]>([]); // newest first
  const [hits, setHits] = useState<Hit[]>([]);
  const [head, setHead] = useState(0);
  const [meta, setMeta] = useState<{ flagged: number; registryOk: boolean; upstream: string } | null>(null);
  const [rates, setRates] = useState({ blocksPerSec: 0, txPerSec: 0 });
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const last = useRef(0);
  const window_ = useRef<{ at: number; blocks: number; tx: number }[]>([]);

  const poll = useCallback(async (signal: AbortSignal) => {
    const res = await fetch(`/api/radar?after=${last.current}`, { signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    const data = body.data as RadarReply;
    const fresh = data.blocks.filter((b) => b.n > last.current);
    last.current = data.head;
    setHead(data.head);
    setMeta({ flagged: data.flaggedAddresses, registryOk: data.registryAvailable, upstream: data.upstream });
    if (fresh.length) {
      const now = performance.now();
      window_.current.push({ at: now, blocks: fresh.length, tx: fresh.reduce((a, b) => a + b.tx, 0) });
      window_.current = window_.current.filter((w) => now - w.at < 12_000);
      const span = Math.max(1, (now - window_.current[0].at + POLL_MS) / 1000);
      setRates({
        blocksPerSec: window_.current.reduce((a, w) => a + w.blocks, 0) / span,
        txPerSec: window_.current.reduce((a, w) => a + w.tx, 0) / span,
      });
      setBlocks((old) => [...[...fresh].sort((a, b) => b.n - a.n), ...old].slice(0, KEEP_BLOCKS));
      const newHits = fresh.flatMap((b) => b.hits.map((h) => ({ ...h, block: b.n }))).reverse();
      if (newHits.length) setHits((old) => [...newHits, ...old].slice(0, KEEP_HITS));
    }
  }, []);

  useEffect(() => {
    if (paused) return;
    const ctl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const tick = async () => {
      if (ctl.signal.aborted) return;
      if (!document.hidden) {
        try {
          await poll(ctl.signal);
          failures = 0;
          setError('');
        } catch (e) {
          if (ctl.signal.aborted) return;
          failures += 1;
          setError(e instanceof Error ? e.message : 'The radar lost its connection.');
        }
      }
      timer = setTimeout(tick, POLL_MS * Math.min(4, 1 + failures));
    };
    void tick();
    return () => {
      ctl.abort();
      clearTimeout(timer);
    };
  }, [paused, poll]);

  async function copyDemo() {
    try {
      await navigator.clipboard.writeText(DEMO_TARGET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this address:', DEMO_TARGET);
    }
  }

  const live = !paused && !error && head > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-ink">
            Live risk radar
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${live ? 'bg-ok/10 text-ok' : 'bg-card2 text-faint'}`}>
              <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-ok' : 'bg-faint'}`} aria-hidden />
              {paused ? 'Paused' : live ? 'Live' : 'Connecting'}
            </span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            New Monad Testnet blocks as they arrive, a few per second. Each transaction gets a quick look: is it paying an address the public registry has flagged, or doing something unusual? These are hints for a
            glance, never verdicts.
          </p>
        </div>
        <button
          onClick={() => setPaused((p) => !p)}
          className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink2 hover:bg-card2"
          aria-pressed={paused}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />} {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {error && <ErrorNote message={`${error} Retrying…`} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Blocks} label="Latest block" value={head ? head.toLocaleString() : '…'} />
        <Stat icon={Zap} label="Blocks per second" value={rates.blocksPerSec ? rates.blocksPerSec.toFixed(1) : '…'} hint="Measured from what this page has received in the last seconds" />
        <Stat icon={Activity} label="Transactions per second" value={rates.txPerSec ? rates.txPerSec.toFixed(1) : '…'} />
        <Stat icon={Radar} label="Hints found" value={hits.length} hint="Since you opened this page" />
      </div>

      <Card title="Transactions per block" icon={Gauge}>
        {blocks.length === 0 ? <p className="text-sm text-muted">Waiting for the first blocks…</p> : <Spark blocks={blocks} />}
        <p className="mt-2 text-xs text-faint">
          Latest {Math.min(blocks.length, KEEP_BLOCKS)} blocks, newest on the right. Amber bars contain a hint. Source: {meta?.upstream ?? '…'}.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Newest blocks" icon={Blocks}>
          <ul className="max-h-[28rem] overflow-y-auto" aria-live="off">
            {blocks.slice(0, 14).map((b) => (
              <li key={b.n} className="flex items-center gap-3 border-b border-line py-2 text-sm last:border-0">
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${b.hits.length ? 'bg-warn' : 'bg-brand/60'}`} aria-hidden />
                <span className="font-mono tabular-nums text-ink">{b.n.toLocaleString()}</span>
                <span className="text-muted">{b.tx} tx</span>
                {b.deployments > 0 && <span className="rounded bg-card2 px-1.5 py-0.5 text-[10px] text-faint">{b.deployments} deploy</span>}
                {b.hits.length > 0 && <span className="rounded bg-warn/10 px-1.5 py-0.5 text-[10px] font-medium text-warn">{b.hits.length} hint</span>}
                <span className="ml-auto text-xs tabular-nums text-faint">{new Date(b.t * 1000).toLocaleTimeString()}</span>
              </li>
            ))}
            {blocks.length === 0 && <li className="py-6 text-center text-sm text-faint">Nothing yet.</li>}
          </ul>
        </Card>

        <Card title="Radar hints" icon={Radar}>
          {hits.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted">
              No hints yet. Testnet can be quiet. To see one, send a tiny test payment to the demo address below (it has two public signals recorded about it) and watch it appear here within seconds.
            </p>
          ) : (
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
              {hits.map((h) => (
                <li key={h.hash} className={`rounded-lg border p-3 text-sm ${h.level === 'high' ? 'border-bad/30 bg-bad/10' : 'border-warn/30 bg-warn/10'}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink2">
                    <span className={`rounded px-1.5 py-0.5 font-semibold ${h.level === 'high' ? 'bg-bad/20 text-bad' : 'bg-warn/20 text-warn'}`}>{h.level === 'high' ? 'High' : 'Medium'}</span>
                    <span>
                      <AddrLink address={h.from} /> → {h.to ? <AddrLink address={h.to} /> : 'new contract'}
                    </span>
                    <span className="tabular-nums">{h.valueMON} MON</span>
                    <a className="ml-auto inline-flex items-center gap-1 underline" href={explorerTxUrl(h.hash)} target="_blank" rel="noreferrer">
                      tx <ExternalLink size={11} />
                    </a>
                  </div>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink2">
                    {h.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-lg bg-card2/60 p-3 text-xs text-muted">
            <div className="font-medium text-ink2">Demo address for a test payment</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="break-all font-mono">{DEMO_TARGET}</code>
              <button onClick={copyDemo} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-ink2 hover:bg-card2">
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <Link className="underline" to={`/address/${DEMO_TARGET}`}>
                Open its page
              </Link>
            </div>
            <div className="mt-1">Plain transfers to it are not stopped by the guard; only payments sent through GuardedPay are.</div>
          </div>
        </Card>
      </div>

      <Card title="What the radar looks for" icon={Radar}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-faint">
          {meta ? `${meta.flagged} address(es) currently have live signals in the registry${meta.registryOk ? '' : ' (registry lookup unavailable right now, so that check is off)'}. ` : ''}
          Everything here comes from the block itself and the public registry, nothing from wallet history, so it is fast but shallow: use the Scanner for a proper look. Network: {MONAD_TESTNET.name}. The page pauses
          itself while the tab is hidden.
        </p>
      </Card>
    </div>
  );
}
