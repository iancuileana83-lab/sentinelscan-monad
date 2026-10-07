import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { Card, ErrorNote } from '@/components/Card';
import { GUARD_ADDRESS, GUARD_POLICY, explorerAddressUrl, explorerTxUrl } from '@/lib/registryConfig';
import { useApi } from '@/lib/useApi';

const loadWallet = () => import('@/lib/wallet');

interface Quote {
  decision: 'allow' | 'confirm' | 'block';
  averageScore: number;
  reporters: number;
  explanation: string;
}

const LOOK = {
  allow: { Icon: ShieldCheck, label: 'Allowed', style: 'border-ok/30 bg-ok/10 text-ok' },
  confirm: { Icon: ShieldAlert, label: 'Confirmation needed', style: 'border-warn/30 bg-warn/10 text-warn' },
  block: { Icon: ShieldX, label: 'Blocked', style: 'border-bad/30 bg-bad/10 text-bad' },
} as const;

/** Shows what the on-chain GuardedPay contract would do for this address, and lets a visitor try it with test MON. */
export default function GuardCard({ address }: { address: string }) {
  const [version, setVersion] = useState(0);
  const { data, error, loading } = useApi<{ data: Quote }>(`/api/guard?address=${address}&v=${version}`);
  const [amount, setAmount] = useState('0.01');
  const [ack, setAck] = useState(false);
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string; hash?: string } | null>(null);
  const walletPresent = typeof window !== 'undefined' && !!window.ethereum;
  const q = data?.data;

  useEffect(() => {
    setNotice(null);
    setAck(false);
  }, [address]);

  async function connect() {
    setBusy(true);
    const w = await loadWallet();
    try {
      setAccount(await w.connectWallet());
    } catch (e) {
      setNotice({ kind: 'error', text: w.friendlyWalletError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    setBusy(true);
    setNotice(null);
    const w = await loadWallet();
    try {
      const { hash, confirmed } = await w.sendGuardedPay(address, amount, ack);
      setNotice({ kind: 'ok', text: 'Sent through the guard. Waiting for confirmation…', hash });
      await confirmed;
      setNotice({ kind: 'ok', text: 'Confirmed: the guard allowed it and forwarded the test MON.', hash });
      setVersion((v) => v + 1);
    } catch (e) {
      setNotice({ kind: 'error', text: w.friendlyWalletError(e) });
    } finally {
      setBusy(false);
    }
  }

  const look = q ? LOOK[q.decision] : null;
  const amountOk = /^\d*\.?\d+$/.test(amount) && Number(amount) > 0;

  return (
    <Card title="On-chain guard: pay through GuardedPay" icon={ShieldCheck}>
      <p className="text-xs leading-relaxed text-faint">
        A small demo contract that reads the public registry before it forwards a payment. From an average score of {GUARD_POLICY.confirmScore} it asks the payer
        to confirm; from {GUARD_POLICY.blockScore} with at least {GUARD_POLICY.minReportersToBlock} reporters it refuses. One reporter alone can never block a
        payment. It is the registry&apos;s opinions applied by code, not proof, and it is testnet only.
      </p>

      {loading && !q && (
        <p className="mt-3 flex items-center gap-2 text-sm text-faint">
          <Loader2 className="animate-spin" size={14} /> Asking the contract…
        </p>
      )}
      {error && <div className="mt-3"><ErrorNote message={error} /></div>}

      {q && look && (
        <div className={`mt-3 flex items-start gap-3 rounded-xl border p-3 ${look.style}`}>
          <look.Icon size={22} className="mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <div className="font-semibold">{look.label}</div>
            <p className="mt-0.5 text-ink2">{q.explanation}</p>
          </div>
        </div>
      )}

      {q && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted">
              Test amount (MON)
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="mt-1 block w-28 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
              />
            </label>
            {q.decision === 'confirm' && (
              <label className="flex items-center gap-2 pb-2 text-sm text-ink2">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="accent-brand" />I understand the risk and want to pay anyway
              </label>
            )}
          </div>
          {!walletPresent ? (
            <p className="text-sm text-faint">Optional: with a browser wallet you could try a test payment through the guard here.</p>
          ) : !account ? (
            <button
              onClick={connect}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand/20 disabled:opacity-50"
            >
              {busy && <Loader2 className="animate-spin" size={14} />} Connect wallet to try a test payment
            </button>
          ) : (
            <button
              onClick={pay}
              disabled={busy || !amountOk}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {busy && <Loader2 className="animate-spin" size={14} />} Pay {amountOk ? amount : '…'} test MON through the guard
            </button>
          )}
          {q.decision === 'block' && account && (
            <p className="text-xs text-faint">You can still press the button: the contract will refuse it, and the wallet will show why before anything is sent.</p>
          )}
        </div>
      )}

      {notice && (
        <p role="status" className={`mt-3 text-sm ${notice.kind === 'ok' ? 'text-ok' : 'text-bad'}`}>
          {notice.text}{' '}
          {notice.hash && (
            <a className="inline-flex items-center gap-1 underline" href={explorerTxUrl(notice.hash)} target="_blank" rel="noreferrer">
              View transaction <ExternalLink size={12} />
            </a>
          )}
        </p>
      )}

      <p className="mt-4 text-xs text-faint">
        Contract{' '}
        <a className="underline" href={explorerAddressUrl(GUARD_ADDRESS)} target="_blank" rel="noreferrer">
          GuardedPay
        </a>{' '}
        (source verified). It keeps no funds and has no owner.
      </p>
    </Card>
  );
}
