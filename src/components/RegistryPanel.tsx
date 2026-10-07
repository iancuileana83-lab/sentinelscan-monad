import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Link2, Loader2, Undo2 } from 'lucide-react';
import { MONAD_TESTNET, REASON_LABELS, REGISTRY_ADDRESS, explorerAddressUrl, explorerTxUrl } from '@/lib/registryConfig';
import { connectWallet, friendlyWalletError, hasWallet, sendReport, sendRetract } from '@/lib/wallet';

interface View {
  reporterCount: number;
  averageScore: number;
  lastReportedAt: number;
  mine?: { score: number; reasonCode: number; reportedAt: number };
}

interface Props {
  subject: string;
  score: number;
  reasonCode: number;
}

export default function RegistryPanel({ subject, score, reasonCode }: Props) {
  const [view, setView] = useState<View | null>(null);
  const [loadError, setLoadError] = useState('');
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string; hash?: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const q = new URLSearchParams({ address: subject });
      if (account) q.set('reporter', account);
      const res = await fetch(`/api/registry?${q}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not read the registry.');
      setView(body.data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not read the registry.');
    }
  }, [subject, account]);

  useEffect(() => {
    setView(null);
    setNotice(null);
    void load();
  }, [load]);

  // Follow account switches made inside the wallet.
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onAccounts = (accounts: unknown) => setAccount(Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : '');
    eth.on('accountsChanged', onAccounts);
    return () => eth.removeListener?.('accountsChanged', onAccounts);
  }, []);

  async function run(label: string, action: () => Promise<{ hash: string; confirmed: Promise<unknown> }>) {
    setBusy(label);
    setNotice(null);
    try {
      const { hash, confirmed } = await action();
      setNotice({ kind: 'ok', text: 'Sent. Waiting for confirmation on Monad…', hash });
      await confirmed;
      setNotice({ kind: 'ok', text: 'Confirmed on Monad Testnet.', hash });
      await load();
    } catch (e) {
      setNotice({ kind: 'error', text: friendlyWalletError(e) });
    } finally {
      setBusy('');
    }
  }

  async function connect() {
    setBusy('connect');
    setNotice(null);
    try {
      setAccount(await connectWallet());
    } catch (e) {
      setNotice({ kind: 'error', text: friendlyWalletError(e) });
    } finally {
      setBusy('');
    }
  }

  const isSelf = !!account && account.toLowerCase() === subject.toLowerCase();
  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <Link2 size={16} className="text-emerald-400" /> Public signals on Monad
      </div>
      <p className="text-xs text-slate-500">
        A public notice board on {MONAD_TESTNET.name}. Anyone can record how they scored an address. It shows opinions, not proof, and
        not a verdict.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat label="Reporters" value={view ? String(view.reporterCount) : '…'} />
        <Stat label="Average score" value={view ? (view.reporterCount ? String(view.averageScore) : '–') : '…'} />
        <Stat
          label="Last report"
          value={view ? (view.lastReportedAt ? new Date(view.lastReportedAt * 1000).toLocaleDateString() : '–') : '…'}
        />
      </div>
      {loadError && <p className="mt-3 text-sm text-rose-300">{loadError}</p>}
      {view && view.reporterCount === 0 && <p className="mt-3 text-sm text-slate-400">Nobody has recorded a signal for this address yet.</p>}

      {view?.mine && (
        <p className="mt-3 text-sm text-slate-300">
          Your signal: <b>{view.mine.score}</b> ({REASON_LABELS[view.mine.reasonCode] ?? 'Other'}). Recording again updates it.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!hasWallet() ? (
          <p className="text-sm text-amber-300">Install a wallet such as MetaMask to record your own signal.</p>
        ) : !account ? (
          <button
            onClick={connect}
            disabled={!!busy}
            className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {busy === 'connect' && <Loader2 className="animate-spin" size={14} />} Connect wallet
          </button>
        ) : (
          <>
            <span className="rounded-md bg-slate-800 px-2 py-1 font-mono text-xs text-slate-400">{short(account)}</span>
            <button
              onClick={() => run('report', () => sendReport(subject, score, reasonCode))}
              disabled={!!busy || isSelf}
              title={isSelf ? 'You cannot record a signal about your own wallet.' : undefined}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === 'report' && <Loader2 className="animate-spin" size={14} />}
              Record on Monad: {score} · {REASON_LABELS[reasonCode]}
            </button>
            {view?.mine && (
              <button
                onClick={() => run('retract', () => sendRetract(subject))}
                disabled={!!busy}
                className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {busy === 'retract' ? <Loader2 className="animate-spin" size={14} /> : <Undo2 size={14} />} Retract mine
              </button>
            )}
          </>
        )}
      </div>
      {isSelf && <p className="mt-2 text-xs text-slate-500">This is your connected wallet, so recording is disabled for it.</p>}

      {notice && (
        <p role="status" className={`mt-3 text-sm ${notice.kind === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {notice.text}{' '}
          {notice.hash && (
            <a className="inline-flex items-center gap-1 underline" href={explorerTxUrl(notice.hash)} target="_blank" rel="noreferrer">
              View transaction <ExternalLink size={12} />
            </a>
          )}
        </p>
      )}

      <p className="mt-4 text-xs text-slate-600">
        Testnet only, no real money. Contract{' '}
        <a className="underline" href={explorerAddressUrl(REGISTRY_ADDRESS)} target="_blank" rel="noreferrer">
          {short(REGISTRY_ADDRESS)}
        </a>
        . You pay a tiny testnet fee, and you can retract your own signal at any time.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}
