import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** A code snippet with a copy button. */
export default function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-canvas p-3 pr-12 text-xs leading-relaxed text-ink2" aria-label={label}>
        <code>{code}</code>
      </pre>
      <button
        className="absolute right-2 top-2 rounded-md border border-line p-1.5 text-muted hover:bg-card2"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            window.prompt('Copy this:', code);
          }
        }}
      >
        {copied ? <Check size={14} className="text-brand-ink" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
