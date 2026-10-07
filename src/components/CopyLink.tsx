import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';

/** Copies the current page address. Falls back to a prompt when the clipboard is blocked. */
export default function CopyLink({ label = 'Copy link' }: { label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      window.prompt('Copy this link:', window.location.href);
    }
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-ink2 hover:bg-card2"
    >
      {done ? <Check size={14} className="text-brand-ink" /> : <Link2 size={14} />}
      {done ? 'Link copied' : label}
    </button>
  );
}
