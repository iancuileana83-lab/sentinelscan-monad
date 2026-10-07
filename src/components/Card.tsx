import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function Card({ title, icon: Icon, children, className = '' }: { title?: string; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-card p-6 shadow-card ${className}`}>
      {title && (
        <h2 className="mb-4 flex items-center gap-2.5 text-base font-semibold text-ink">
          {Icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand-ink">
              <Icon size={17} aria-hidden />
            </span>
          )}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint?: string; icon?: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-card" title={hint}>
      <div className="flex items-center gap-2 text-xs text-faint">
        {Icon && <Icon size={14} className="text-brand-ink" aria-hidden />}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-bad/30 bg-bad/10 p-3 text-sm text-bad">
      {message}
    </div>
  );
}
