import { useState } from 'react';
import { AlertCircle, ArrowRight, Loader2, Search, ShieldCheck, Wallet } from 'lucide-react';
import RiskGauge from '@/components/RiskGauge';
import RiskExplainer from '@/components/RiskExplainer';
import { assessWalletRisk, type WalletData, type WalletRiskAssessment } from '@/lib/walletRisk';
import { assessTxRisk, type TxData, type TxRiskAssessment } from '@/lib/txRisk';
import { explainTxRisk, explainWalletRisk, type RiskExplanation } from '@/lib/riskExplainer';

type Mode = 'wallet' | 'transaction';

interface Factor {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface Result {
  mode: Mode;
  target: string;
  score: number;
  level: 'safe' | 'caution' | 'danger';
  factors: Factor[];
  explanation: RiskExplanation;
  facts: { label: string; value: string }[];
  warning?: string;
}

const severityStyle: Record<Factor['severity'], string> = {
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  critical: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

function fromWei(wei: string): string {
  const mon = Number(BigInt(wei || '0')) / 1e18;
  return `${mon.toLocaleString(undefined, { maximumFractionDigits: 4 })} MON`;
}

async function callApi<T>(path: string): Promise<{ data: T; warning?: string }> {
  const res = await fetch(path);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('wallet');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  async function scan() {
    const value = input.trim();
    if (!value) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      if (mode === 'wallet') {
        const { data, warning } = await callApi<WalletData & { balanceWei: string }>(
          `/api/wallet-scan?address=${encodeURIComponent(value)}`
        );
        const a: WalletRiskAssessment = assessWalletRisk(data);
        setResult({
          mode,
          target: data.address,
          score: a.score,
          level: a.level,
          factors: a.riskFactors,
          explanation: explainWalletRisk(data, a),
          warning,
          facts: [
            { label: 'Balance', value: fromWei(data.balanceWei) },
            { label: 'Transactions (latest 100)', value: String(data.txCount) },
            { label: 'Tokens seen', value: String(data.tokenCount) },
            { label: 'First seen', value: data.firstSeen ? new Date(data.firstSeen).toLocaleDateString() : 'n/a' },
          ],
        });
      } else {
        const { data } = await callApi<TxData>(`/api/tx-scan?hash=${encodeURIComponent(value)}`);
        const a: TxRiskAssessment = assessTxRisk(data);
        setResult({
          mode,
          target: data.hash,
          score: a.score,
          level: a.level,
          factors: a.riskFactors,
          explanation: explainTxRisk(data, a),
          facts: [
            { label: 'Status', value: data.isSuccess ? 'Success' : 'Failed' },
            { label: 'Value', value: fromWei(data.value) },
            { label: 'Block', value: String(data.blockNumber) },
            { label: 'Token transfers', value: String(data.tokenTransfers.length) },
          ],
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <ShieldCheck className="text-emerald-400" size={26} />
          <div>
            <h1 className="text-lg font-semibold text-slate-100">SentinelScan on Monad</h1>
            <p className="text-xs text-slate-500">Risk signals for wallets and transactions · Monad Testnet only</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
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
              className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition ${
                mode === m
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 text-slate-400 hover:bg-slate-800'
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

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <Wallet size={14} /> {result.mode}
              </div>
              <p className="break-all font-mono text-sm text-slate-300">{result.target}</p>
              {result.warning && <p className="mt-2 text-sm text-amber-300">{result.warning}</p>}
              <div className="mt-4 flex justify-center">
                <RiskGauge score={result.score} level={result.level} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {result.facts.map((f) => (
                  <div key={f.label} className="rounded-lg bg-slate-800/50 p-3">
                    <dt className="text-xs text-slate-500">{f.label}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-slate-200">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-100">Signals found</h2>
              {result.factors.map((f) => (
                <div key={f.title} className={`rounded-lg border p-3 ${severityStyle[f.severity]}`}>
                  <div className="text-sm font-medium">{f.title}</div>
                  <p className="mt-0.5 text-sm text-slate-300">{f.description}</p>
                </div>
              ))}
            </div>

            <RiskExplainer explanation={result.explanation} type={result.mode} />
          </section>
        )}

        <p className="pt-4 text-xs leading-relaxed text-slate-600">
          Scores describe the likelihood of risky patterns in public on-chain data. They are signals, not verdicts, and not
          financial advice. Monad Testnet tokens have no real value.
        </p>
      </main>
    </div>
  );
}
