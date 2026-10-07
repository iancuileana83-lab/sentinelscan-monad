import { useState } from 'react';
import { Bot, CircleCheck, CircleHelp, CircleX, Loader2, Play, Wrench } from 'lucide-react';
import { CitationChips, EvidenceList, type EvidenceItem } from '@/components/AiParts';
import { Card, ErrorNote } from '@/components/Card';
import { DEMO_TARGET } from '@/lib/registryConfig';
import { useAiStatus } from '@/lib/useAiStatus';

interface Result {
  task: { address: string; amountMon: string };
  steps: { name: string; args: Record<string, unknown>; ok: boolean; auto?: boolean; evidence: string[]; error?: string }[];
  evidence: EvidenceItem[];
  decision: 'pay' | 'refuse' | 'ask_human';
  summary: string;
  reasons: { text: string; evidence: string[] }[];
  guard: 'allow' | 'confirm' | 'block' | 'unknown';
  overridden: string | null;
  fallback: string | null;
  proposedCall: string | null;
  model: { provider: string; name: string } | null;
  usage: { prompt: number; completion: number } | null;
  ms: number;
}

const SCENARIOS = [
  { label: 'Demo address', note: 'two test reporters scored it high: the guard should block it', address: DEMO_TARGET },
  { label: 'System account', note: 'one reporter, average 65: the guard asks for confirmation', address: '0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e' },
  { label: 'Fresh test wallet', note: 'nobody has reported it', address: '0x0c6b75389A0d48F2eb16Cc91022728fb6CBE7FC5' },
];

const OUTCOME = {
  pay: { Icon: CircleCheck, label: 'Would pay', style: 'border-ok/30 bg-ok/10 text-ok' },
  ask_human: { Icon: CircleHelp, label: 'Asks a human first', style: 'border-warn/30 bg-warn/10 text-warn' },
  refuse: { Icon: CircleX, label: 'Refuses to pay', style: 'border-bad/30 bg-bad/10 text-bad' },
} as const;

/** A real model-driven agent: it picks tools, reads the evidence and decides. It never sends money. */
export default function AgentDemo() {
  const status = useAiStatus();
  const [address, setAddress] = useState(DEMO_TARGET);
  const [amount, setAmount] = useState('0.5');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  async function run(addr = address) {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/agent-demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, amountMon: amount }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setResult(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const out = result ? OUTCOME[result.decision] : null;

  return (
    <Card title="Watch an AI agent decide whether to pay" icon={Bot}>
      <p className="text-sm leading-relaxed text-muted">
        The agent is asked to pay an address. It chooses which of our read-only tools to call, reads the numbered evidence, and answers with reasons that cite it. It <b>never sends money</b>, and it cannot
        override the on-chain guard: a blocked address is always refused, and a risky one always goes to a human.
      </p>
      {status && !status.enabled && <p className="mt-2 text-xs text-warn">The AI model is switched off, so the agent runs in plain mode: same tools and guard, answer built from the evidence alone.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.address}
            title={s.note}
            disabled={busy}
            onClick={() => {
              setAddress(s.address);
              void run(s.address);
            }}
            className="rounded-full border border-line bg-card px-3 py-1 text-xs text-ink2 hover:border-brand/50 hover:bg-card2 disabled:opacity-50"
          >
            {s.label}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          spellCheck={false}
          aria-label="Address to pay"
          className="flex-1 rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Amount in MON"
          inputMode="decimal"
          className="w-24 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button type="submit" disabled={busy} className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />} Run the agent
        </button>
      </form>
      {status?.enabled && <p className="mt-2 text-xs text-faint">{status.runsLeftToday} AI runs left today for all visitors. Results are cached for ten minutes.</p>}
      {busy && <p className="mt-3 text-sm text-muted">The agent is checking the address. This can take up to half a minute…</p>}
      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}

      {result && out && (
        <div className="mt-5 space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">What the agent did</h3>
            <ol className="space-y-1.5">
              {result.steps.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-card2/60 px-3 py-2 text-xs text-ink2">
                  <Wrench size={13} className="text-brand-ink" aria-hidden />
                  <code className="font-semibold">{s.name}</code>
                  {s.auto && <span className="rounded bg-card2 px-1.5 py-0.5 text-[10px] text-faint">added by the server as a safety check</span>}
                  {s.error ? <span className="text-bad">{s.error}</span> : <CitationChips ids={s.evidence} onPick={setPicked} />}
                </li>
              ))}
            </ol>
          </div>

          <div className={`flex items-start gap-3 rounded-xl border p-4 ${out.style}`}>
            <out.Icon size={26} className="mt-0.5 flex-shrink-0" aria-hidden />
            <div className="min-w-0">
              <div className="text-base font-semibold">
                {out.label}: {result.task.amountMon} MON
              </div>
              <p className="mt-1 text-sm text-ink2">{result.summary}</p>
            </div>
          </div>

          {result.overridden && <p className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm text-warn">{result.overridden}</p>}
          {result.fallback && <p className="rounded-lg border border-line bg-card2/60 p-3 text-sm text-muted">{result.fallback}</p>}

          <ul className="space-y-2">
            {result.reasons.map((r, i) => (
              <li key={i} className="rounded-lg bg-card2/60 p-3 text-sm text-ink2">
                {r.text}
                <CitationChips ids={r.evidence} onPick={setPicked} />
              </li>
            ))}
          </ul>

          <EvidenceList items={result.evidence} highlight={picked} defaultOpen={!!picked} />

          {result.proposedCall && <p className="rounded-lg bg-card2/60 p-3 font-mono text-xs text-muted">{result.proposedCall}</p>}
          <p className="text-xs text-faint">
            {result.model ? `Model: ${result.model.name} (${result.model.provider}). ` : 'No AI model used. '}
            {result.usage ? `${result.usage.prompt + result.usage.completion} tokens. ` : ''}
            {(result.ms / 1000).toFixed(1)} s. The on-chain guard decision was <b>{result.guard}</b>. A score is a signal, not a verdict.
          </p>
        </div>
      )}
    </Card>
  );
}
