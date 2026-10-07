import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { CitationChips, EvidenceList, type EvidenceItem } from '@/components/AiParts';
import { Card, ErrorNote } from '@/components/Card';
import { useAiStatus } from '@/lib/useAiStatus';

interface Analysis {
  summary: string;
  points: { text: string; evidence: string[] }[];
  uncertainty: string;
  evidence: EvidenceItem[];
  fallback: string | null;
  model: { provider: string; name: string } | null;
  ms: number;
}

/** AI notes about one wallet. Every note cites numbered evidence; notes that cite nothing real are removed on the server. */
export default function AnalystCard({ address }: { address: string }) {
  const status = useAiStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Analysis | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/analyst', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      setResult(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (status && !status.enabled) return null;

  return (
    <Card title="AI analyst" icon={Sparkles}>
      <p className="text-xs leading-relaxed text-faint">
        Short notes written by an AI model from numbered evidence in our own scan and the public registry. Each note must cite evidence; notes that cite nothing real are removed. It can still be
        wrong, so it is a reading aid, not a verdict.
      </p>
      {!result && (
        <button
          onClick={run}
          disabled={busy}
          className="mt-4 flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-hover disabled:opacity-60"
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Ask the AI analyst
        </button>
      )}
      {status && <p className="mt-2 text-xs text-faint">{status.runsLeftToday} AI runs left today for all visitors.</p>}
      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}
      {result && (
        <div className="mt-4 space-y-4">
          {result.fallback ? (
            <p className="rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm text-warn">{result.fallback}</p>
          ) : (
            <>
              {result.summary && <p className="text-sm leading-relaxed text-ink">{result.summary}</p>}
              <ul className="space-y-2">
                {result.points.map((p, i) => (
                  <li key={i} className="rounded-lg bg-card2/60 p-3 text-sm text-ink2">
                    {p.text}
                    <CitationChips ids={p.evidence} onPick={setPicked} />
                  </li>
                ))}
              </ul>
              {result.uncertainty && <p className="text-xs italic text-muted">What we cannot tell: {result.uncertainty}</p>}
            </>
          )}
          <EvidenceList items={result.evidence} highlight={picked} defaultOpen={!!picked} />
          <p className="text-xs text-faint">
            Written by {result.model ? `${result.model.name} (${result.model.provider})` : 'an AI model'} in {(result.ms / 1000).toFixed(1)} s. AI-generated; check the evidence.
          </p>
        </div>
      )}
    </Card>
  );
}
