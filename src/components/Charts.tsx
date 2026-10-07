// Small, dependency-free charts. Each one has a text alternative for screen readers.

export interface Bar {
  label: string;
  value: number;
  /** Tailwind background class for the bar, from the colour tokens. */
  tone?: string;
}

export function BarChart({ bars, title, height = 120 }: { bars: Bar[]; title: string; height?: number }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const summary = bars.map((b) => `${b.label}: ${b.value}`).join(', ');
  return (
    <figure>
      <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label={`${title}. ${summary}`}>
        {bars.map((b) => (
          <div key={b.label} className="flex h-full flex-1 flex-col justify-end" title={`${b.label}: ${b.value}`}>
            <span className="mb-1 text-center text-[10px] tabular-nums text-faint">{b.value > 0 ? b.value : ''}</span>
            <div
              className={`w-full rounded-t-md transition-all ${b.tone ?? 'bg-brand'} ${b.value === 0 ? 'opacity-25' : ''}`}
              style={{ height: `${Math.max(b.value === 0 ? 3 : 8, (b.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5" aria-hidden>
        {bars.map((b) => (
          <span key={b.label} className="flex-1 text-center text-[10px] text-faint">
            {b.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {bars.map((b) => (
            <tr key={b.label}>
              <th scope="row">{b.label}</th>
              <td>{b.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function HBars({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between text-ink2">
            <span>{r.label}</span>
            <span className="tabular-nums text-faint">{r.count}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-card2">
            <div className="h-2.5 rounded-full bg-brand" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The tone for a score bucket: green, amber, red only here, as risk colours. */
export const toneForScore = (lowEdge: number) => (lowEdge < 40 ? 'bg-ok' : lowEdge < 70 ? 'bg-warn' : 'bg-bad');
