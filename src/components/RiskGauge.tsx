import { useEffect, useState } from 'react';
import type { RiskLevel } from '@/types';

interface RiskGaugeProps {
  score: number;
  level: RiskLevel;
}

const levelMeta: Record<RiskLevel, { token: string; label: string; text: string; note: string }> = {
  safe: { token: 'ok', label: 'Low risk', text: 'text-ok', note: 'No strong patterns found' },
  caution: { token: 'warn', label: 'Caution', text: 'text-warn', note: 'Worth a closer look' },
  danger: { token: 'bad', label: 'High risk', text: 'text-bad', note: 'Many patterns at once' },
};

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A circular gauge that draws itself and counts up. Green, amber and red appear only here and in risk badges. */
export default function RiskGauge({ score, level }: RiskGaugeProps) {
  const meta = levelMeta[level];
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(score);
      return;
    }
    const duration = 1100;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setShown(Math.round((1 - Math.pow(1 - t, 3)) * score));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const offset = CIRCUMFERENCE * (1 - shown / 100);
  const color = `rgb(var(--c-${meta.token}))`;

  return (
    <div className="flex flex-col items-center" role="img" aria-label={`Risk score ${score} out of 100: ${meta.label}`}>
      <div className="relative h-44 w-44">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
          <circle cx="90" cy="90" r={RADIUS} fill="none" strokeWidth="14" stroke="rgb(var(--c-line))" />
          <circle
            cx="90"
            cy="90"
            r={RADIUS}
            fill="none"
            strokeWidth="14"
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px rgb(var(--c-${meta.token}) / 0.45))` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold tabular-nums text-ink">{shown}</span>
          <span className="text-xs font-medium tracking-wide text-faint">out of 100</span>
        </div>
      </div>
      <div className={`mt-1 text-lg font-semibold ${meta.text}`}>{meta.label}</div>
      <div className="text-xs text-faint">{meta.note}</div>
    </div>
  );
}
