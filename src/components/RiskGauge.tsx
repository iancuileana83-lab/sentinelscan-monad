import { useEffect, useState } from 'react';
import type { RiskLevel } from '@/types';

interface RiskGaugeProps {
  score: number;
  level: RiskLevel;
}

const levelMeta: Record<
  RiskLevel,
  { color: string; glow: string; label: string; text: string }
> = {
  safe: {
    color: '#10b981',
    glow: 'drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]',
    label: 'Low Risk',
    text: 'text-emerald-400',
  },
  caution: {
    color: '#f59e0b',
    glow: 'drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]',
    label: 'Caution',
    text: 'text-amber-400',
  },
  danger: {
    color: '#f43f5e',
    glow: 'drop-shadow-[0_0_20px_rgba(244,63,94,0.4)]',
    label: 'High Risk',
    text: 'text-rose-400',
  },
};

export default function RiskGauge({ score, level }: RiskGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const meta = levelMeta[level];

  useEffect(() => {
    const duration = 900;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedScore(Math.round(eased * score));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const radius = 120;
  const circumference = Math.PI * radius;
  const progress = animatedScore / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center">
      <svg
        width="280"
        height="160"
        viewBox="0 0 280 160"
        className={meta.glow}
      >
        <defs>
          <linearGradient id={`grad-${level}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={meta.color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={meta.color} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Track */}
        <path
          d={`M 30 140 A ${radius} ${radius} 0 0 1 250 140`}
          fill="none"
          stroke="currentColor"
          strokeWidth="16"
          strokeLinecap="round"
          className="text-slate-700/60"
        />
        {/* Progress */}
        <path
          d={`M 30 140 A ${radius} ${radius} 0 0 1 250 140`}
          fill="none"
          stroke={`url(#grad-${level})`}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.1s linear' }}
        />
        {/* Score text */}
        <text
          x="140"
          y="125"
          textAnchor="middle"
          className="fill-slate-100 font-bold"
          style={{ fontSize: '3rem' }}
        >
          {animatedScore}
        </text>
        <text
          x="140"
          y="148"
          textAnchor="middle"
          className="fill-slate-500 font-medium"
          style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}
        >
          / 100
        </text>
      </svg>
      <div className={`-mt-2 text-lg font-semibold ${meta.text}`}>
        {meta.label}
      </div>
    </div>
  );
}
