import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Bot, FileCode2, Loader2, Search, Sparkles, Users } from 'lucide-react';
import ScanResult from '@/components/ScanResult';
import { DEMO_TARGET } from '@/lib/registryConfig';
import type { ScanView } from '@/lib/viewTypes';

type Mode = 'wallet' | 'transaction';

const EXAMPLES: Record<Mode, { label: string; note: string; value: string }[]> = {
  wallet: [
    { label: 'System account', note: 'pays staking rewards, so a pure outflow pattern', value: '0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e' },
    { label: 'Fresh test wallet', note: 'a new wallet with a few transactions', value: '0x0c6b75389A0d48F2eb16Cc91022728fb6CBE7FC5' },
    { label: 'RiskRegistry contract', note: 'the public contract behind this app', value: '0xb0C3Be753788a5962DE52db929f49df02700AFd4' },
  ],
  transaction: [
    { label: 'Reward transfer', note: 'a system transfer of 18 MON', value: '0x5457906afbd449d0334b9e7f0a7ad4ea95c46f5c8dd9bca4aef1cdef262fefa2' },
    { label: 'Contract deployment', note: 'the transaction that created RiskRegistry', value: '0x2d86c87d9c08bef92e2beaee42c24bab5b90e3dc2dd606240e644ca5f644113c' },
  ],
};

const AUDIENCES = [
  {
    Icon: Users,
    title: 'For people',
    text: 'Paste an address or a transaction. See a 0 to 100 signal, the patterns behind it and the on-chain evidence. No wallet, no sign-in.',
    to: '/address/0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e',
    cta: 'See an address page',
  },
  {
    Icon: FileCode2,
    title: 'For smart contracts',
    text: 'GuardedPay reads the public registry on-chain: it asks the payer to confirm risky addresses and refuses the ones several reporters agree on.',
    to: `/address/${DEMO_TARGET}`,
    cta: 'See the guard block a payment',
  },
  {
    Icon: Bot,
    title: 'For AI agents',
    text: 'Read-only MCP tools return the score with its evidence, so an agent can check an address before it pays. They never sign or send anything.',
    to: '/agents',
    cta: 'Try the tools',
  },
];

export default function ScannerPage() {
  const [mode, setMode] = useState<Mode>('wallet');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ view: ScanView; warning?: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function scan(value = input) {
    const target = value.trim();
    if (!target) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const path = mode === 'wallet' ? `/api/wallet-scan?address=${encodeURIComponent(target)}` : `/api/tx-scan?hash=${encodeURIComponent(target)}`;
      const res = await fetch(path);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setResult({ view: body.data, warning: body.warning });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-card px-5 py-10 shadow-card sm:px-10 sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, rgb(var(--hero-glow)), transparent)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, rgb(var(--hero-glow)), transparent)' }}
        />
        <div className="relative mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand-ink">
            <Sparkles size={13} aria-hidden /> Free · No wallet needed · Monad Testnet
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">Check a Monad address before you trust it.</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
            Risk signals for wallets and transactions, with the reasons and the on-chain evidence behind every score. A signal, never a verdict.
          </p>

          <div className="mx-auto mt-8 max-w-xl text-left">
            <div className="mb-3 flex justify-center gap-2" role="tablist" aria-label="What to scan">
              {(['wallet', 'transaction'] as Mode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => {
                    setMode(m);
                    setInput('');
                    setResult(null);
                    setError('');
                  }}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    mode === m ? 'border-brand bg-brand text-white' : 'border-line bg-card text-muted hover:bg-card2'
                  }`}
                >
                  {m === 'wallet' ? 'Wallet' : 'Transaction'}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void scan();
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3.5 text-faint" size={18} aria-hidden />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  spellCheck={false}
                  placeholder={mode === 'wallet' ? 'Wallet address (0x…)' : 'Transaction hash (0x…)'}
                  aria-label={mode === 'wallet' ? 'Wallet address' : 'Transaction hash'}
                  className="w-full rounded-xl border border-line bg-canvas py-3 pl-11 pr-3 font-mono text-sm text-ink placeholder-faint shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-brand-hover disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                Scan
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-faint">Try an example:</span>
              {EXAMPLES[mode].map((ex) => (
                <button
                  key={ex.value}
                  title={ex.note}
                  aria-label={ex.label}
                  disabled={loading}
                  onClick={() => {
                    setInput(ex.value);
                    void scan(ex.value);
                  }}
                  className="rounded-full border border-line bg-card px-3 py-1 text-xs text-ink2 transition hover:border-brand/50 hover:bg-card2 disabled:opacity-50"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div ref={resultRef} className="scroll-mt-24">
        {error && (
          <div role="alert" className="mx-auto flex max-w-3xl items-start gap-2 rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-bad">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}
        {result && (
          <div className="mx-auto max-w-3xl">
            <ScanResult view={result.view} warning={result.warning} />
          </div>
        )}
      </div>

      {!result && (
        <section aria-label="Who it is for" className="grid gap-4 md:grid-cols-3">
          {AUDIENCES.map(({ Icon, title, text, to, cta }) => (
            <div key={title} className="flex flex-col rounded-2xl border border-line bg-card p-6 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand-ink">
                <Icon size={22} aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{text}</p>
              <Link to={to} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline">
                {cta} <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
