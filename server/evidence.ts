// Numbered evidence for the AI parts. Every fact an AI is allowed to use gets an id (E1, E2, ...),
// and every claim it makes must cite ids that exist here. Only numbers, addresses, hashes and fixed
// labels go in: text chosen by contract deployers (token names and the like) never enters the evidence.
import { cleanText } from './safe.ts';

export interface EvidenceItem {
  id: string;
  source: string;
  text: string;
}

export class Evidence {
  items: EvidenceItem[] = [];

  add(source: string, text: string): EvidenceItem {
    const item = { id: `E${this.items.length + 1}`, source, text: cleanText(text, 220) };
    this.items.push(item);
    return item;
  }

  has(id: unknown): boolean {
    return typeof id === 'string' && this.items.some((i) => i.id === id);
  }

  /** Turns one tool result into numbered facts. Unknown tools produce no evidence. */
  addFromTool(tool: string, data: unknown): EvidenceItem[] {
    const d = data as Record<string, any>;
    const out: EvidenceItem[] = [];
    if (!d || typeof d !== 'object') return out;
    if (tool === 'scan_wallet') {
      out.push(this.add(tool, `Risk signal ${d.riskSignal?.score}/100 (${d.riskSignal?.level}); main reason: ${d.riskSignal?.reasonLabel}.`));
      for (const s of (d.signals ?? []).slice(0, 4)) out.push(this.add(tool, `Signal [${s.severity}] ${s.title}.`));
      out.push(
        this.add(
          tool,
          `${d.facts?.transactionsAnalyzed} transactions analyzed (latest 100 only); balance ${d.facts?.balanceMON} MON; first seen ${String(d.facts?.firstSeen ?? 'n/a').slice(0, 10)}.`
        )
      );
      const top = d.evidence?.topCounterparties?.[0];
      if (top) out.push(this.add(tool, `Most frequent counterparty ${top.address} with ${top.interactions} interactions.`));
    } else if (tool === 'get_registry_signals') {
      out.push(
        this.add(
          tool,
          `Registry: ${d.reporterCount} reporter(s), plain average ${d.averageScore ?? 'n/a'}, last report ${d.lastReportedAt ? String(d.lastReportedAt).slice(0, 10) : 'none'}.`
        )
      );
      const w = d.reputationWeighted;
      if (w?.reporters?.length) out.push(this.add(tool, `Reputation-weighted average ${w.weightedAverage} (plain ${w.plainAverage}); effective reporters ${w.effectiveReporters}.`));
    } else if (tool === 'guard_quote') {
      out.push(this.add(tool, `GuardedPay decision: ${String(d.decision).toUpperCase()} (${d.reporters} reporter(s), average ${d.averageScore}).`));
    } else if (tool === 'scan_transaction') {
      out.push(this.add(tool, `Transaction risk signal ${d.riskSignal?.score}/100 (${d.riskSignal?.level}); status ${d.facts?.status}.`));
    }
    return out;
  }
}

/** Keeps only the citations that exist; returns null when nothing valid is left. */
export function validCitations(ids: unknown, evidence: Evidence): string[] | null {
  if (!Array.isArray(ids)) return null;
  const good = [...new Set(ids.filter((i): i is string => typeof i === 'string' && evidence.has(i)))];
  return good.length ? good : null;
}

/** Pulls the first JSON object out of a model reply, which may wrap it in text or code fences. */
export function extractJson(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
