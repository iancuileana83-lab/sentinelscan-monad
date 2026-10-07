import { useState } from 'react';
import { AlertCircle, ArrowRight, Loader2, Search } from 'lucide-react';
import ScanResult from '@/components/ScanResult';
import type { ScanView } from '@/lib/viewTypes';

type Mode = 'wallet' | 'transaction';

export const EXAMPLES: Record<Mode, { label: string; note: string; value: string }[]> = {
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

export default function ScannerPage() {
  const [mode, setMode] = useState<Mode>('wallet');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ view: ScanView; warning?: string } | null>(null);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm leading-relaxed text-slate-400">
        Paste a wallet address or transaction hash from Monad Testnet to see a 0 to 100 signal, the reasons behind it and the on-chain
        evidence. No sign-in, no wallet needed. The scores are signals, not verdicts.
      </p>

      <div className="flex gap-2">
        {(['wallet', 'transaction'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setInput('');
              setResult(null);
              setError('');
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              mode === m ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
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
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-500" size={18} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder={mode === 'wallet' ? 'Wallet address (0x…)' : 'Transaction hash (0x…)'}
            aria-label={mode === 'wallet' ? 'Wallet address' : 'Transaction hash'}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 font-mono text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
          Scan
        </button>
      </form>

      <div className="space-y-1.5">
        <div className="text-xs text-slate-500">Try an example:</div>
        <div className="flex flex-wrap gap-2">
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
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && <ScanResult view={result.view} warning={result.warning} />}
    </div>
  );
}
