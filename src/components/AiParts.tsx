import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface EvidenceItem {
  id: string;
  source: string;
  text: string;
}

/** Small chips such as E3 that point at a numbered evidence row. */
export function CitationChips({ ids, onPick }: { ids: string[]; onPick?: (id: string) => void }) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick?.(id)}
          className="rounded-md bg-brand/10 px-1.5 py-0.5 text-[11px] font-medium text-brand-ink hover:bg-brand/20"
          aria-label={`Evidence ${id}`}
        >
          {id}
        </button>
      ))}
    </span>
  );
}

/** The numbered facts the AI was allowed to use. Collapsed by default. */
export function EvidenceList({ items, highlight, defaultOpen = false }: { items: EvidenceItem[]; highlight?: string | null; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-line bg-card2/50">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-ink2" aria-expanded={open}>
        <span>Evidence the AI was allowed to use ({items.length})</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <ul className="space-y-1.5 border-t border-line px-4 py-3">
          {items.map((e) => (
            <li key={e.id} id={`ev-${e.id}`} className={`flex gap-2 rounded-md px-2 py-1 text-xs ${highlight === e.id ? 'bg-brand/15' : ''}`}>
              <span className="w-8 flex-shrink-0 font-semibold text-brand-ink">{e.id}</span>
              <span className="text-ink2">{e.text}</span>
              <span className="ml-auto flex-shrink-0 font-mono text-[10px] text-faint">{e.source}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
