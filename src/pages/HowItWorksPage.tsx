import { useState } from 'react';
import { ArrowLeftRight, BookOpen, Database, Gauge, Lightbulb, Scale, ShieldCheck, Sparkles, TriangleAlert, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/Card';
import { LEVELS, LIMITS, TX_RULES, WALLET_RULES, type Rule } from '@/lib/rules';
import { GUARD_POLICY, MONAD_TESTNET, REASON_LABELS } from '@/lib/registryConfig';
// The same pure function the server uses, so the calculator below cannot disagree with the real weights.
import { FULL_ACTIVITY_TXS, FULL_AGE_DAYS, SPAM_FREE_REPORTS, WEIGHT_FLOOR, reputationWeight } from '../../server/reputation';

function RuleTable({ rules }: { rules: Rule[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs text-faint">
          <tr>
            <th className="pb-2 pr-3 font-medium">Pattern</th>
            <th className="pb-2 pr-3 font-medium">Points</th>
            <th className="pb-2 font-medium">When it applies</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.name} className="border-t border-line align-top">
              <td className="py-2 pr-3 text-ink">{r.name}</td>
              <td className="py-2 pr-3 whitespace-nowrap text-brand-ink">{r.points}</td>
              <td className="py-2 text-muted">{r.when}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Slider({ label, value, max, onChange, unit = '' }: { label: string; value: number; max: number; onChange: (n: number) => void; unit?: string }) {
  return (
    <label className="block text-sm text-ink2">
      <span className="flex justify-between">
        <span>{label}</span>
        <b className="text-ink">
          {value}
          {unit}
        </b>
      </span>
      <input className="mt-1 w-full accent-brand" type="range" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function WeightCalculator() {
  const [age, setAge] = useState(0);
  const [txs, setTxs] = useState(2);
  const [made, setMade] = useState(1);
  const w = reputationWeight({ ageDays: age, transactions: txs, reportsMade: made });
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-4">
        <Slider label="Wallet age" value={age} max={60} unit=" days" onChange={setAge} />
        <Slider label="Transactions seen" value={txs} max={100} onChange={setTxs} />
        <Slider label="Live signals recorded" value={made} max={40} onChange={setMade} />
      </div>
      <div className="rounded-xl bg-card2/50 p-4 text-sm text-ink2">
        <div className="text-xs text-faint">Resulting weight</div>
        <div className="text-3xl font-semibold text-ink">{w.weight}</div>
        <ul className="mt-2 space-y-1 text-xs text-muted">
          <li>age credit {Math.round(w.age * 100)}%</li>
          <li>activity credit {Math.round(w.activity * 100)}%</li>
          <li>restraint factor {w.restraint}</li>
        </ul>
      </div>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">How it works</h1>
        <p className="mt-1 text-sm text-muted">
          Everything on this site is a rule you can read. There is no hidden model behind the scores, and no score is a verdict.
        </p>
      </div>

      <Card title="The idea: signal, not verdict" icon={Lightbulb}>
        <div className="space-y-2 text-sm leading-relaxed text-muted">
          <p>
            A score says how many <i>patterns</i> in public on-chain data look unusual. Many of those patterns also describe bots, payout accounts and system
            accounts. So every result comes with the reasons behind it, and the explanation separates the facts read from the chain from what they might mean.
          </p>
          <p>
            The public registry follows the same rule: a reporter records a score and one reason from a fixed list ({REASON_LABELS.slice(1).join(', ').toLowerCase()}, or other).
            There is no free text, so it cannot be used to publish accusations.
          </p>
        </div>
      </Card>

      <Card title="Score levels" icon={Gauge}>
        <ul className="space-y-2 text-sm">
          {LEVELS.map((l) => (
            <li key={l.range} className="flex flex-wrap gap-x-3">
              <span className="w-24 font-medium text-ink">{l.range}</span>
              <span className="w-24 text-brand-ink">{l.label}</span>
              <span className="text-muted">{l.meaning}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-faint">Points add up and are capped at 100.</p>
      </Card>

      <Card title="Wallet rules" icon={Wallet}>
        <RuleTable rules={WALLET_RULES} />
      </Card>

      <Card title="Transaction rules" icon={ArrowLeftRight}>
        <RuleTable rules={TX_RULES} />
      </Card>

      <Card title="Where the data comes from" icon={Database}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Wallet history, token transfers and contract events: the Etherscan API V2 for Monad Testnet (chain {MONAD_TESTNET.chainId}).</li>
          <li>Transactions, receipts, blocks and contract reads: public Monad Testnet RPC endpoints, with automatic fallback between three of them.</li>
          <li>The explorer key stays on the server. The browser never sees it.</li>
        </ul>
      </Card>

      <Card title="The public registry (RiskRegistry)" icon={BookOpen}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>One live signal per reporter and address. Recording again updates your own signal, so one wallet cannot inflate a count.</li>
          <li>Only the author can retract a signal. Nobody can change or remove someone else&apos;s.</li>
          <li>No owner, no admin, no fees, no funds held, no upgrade path. The source is verified on the explorer.</li>
          <li>You cannot report your own address or the zero address.</li>
        </ul>
      </Card>

      <Card title="The on-chain guard (GuardedPay)" icon={ShieldCheck}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>A small contract that reads the registry before it forwards a payment, in the same transaction.</li>
          <li>Average score from {GUARD_POLICY.confirmScore} with {GUARD_POLICY.minReportersToConfirm} reporter: the payer must tick &quot;I understand the risk&quot;, or the payment reverts.</li>
          <li>Average score from {GUARD_POLICY.blockScore} with at least {GUARD_POLICY.minReportersToBlock} reporters: the payment is refused, even if acknowledged.</li>
          <li>One reporter alone can never block a payment, so a single wallet cannot freeze payments to someone. Many wallets still could, which is why this is a demo.</li>
          <li>It uses the plain on-chain average. It holds no funds, has no owner, and the source is verified on the explorer.</li>
        </ul>
        <p className="mt-3 text-xs text-faint">
          Try it on any <Link className="underline" to="/">address page</Link>. The demo address has two test reporters and is blocked; the system account needs a confirmation.
        </p>
      </Card>

      <Card title="The AI parts" icon={Sparkles}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>The payment agent and the analyst are language models that only see numbered evidence from our own scan and the registry. Each claim must cite evidence ids; claims that cite nothing real are removed.</li>
          <li>Token names, symbols and other text chosen by contract deployers never reach the model, because they could carry instructions.</li>
          <li>The agent cannot override the on-chain guard: a blocked address is always refused, and a risky one always goes to a human. If the model fails, a plain answer built from the same evidence is shown.</li>
          <li>The agent never sends money. Runs are limited per visitor and per day, and the AI can be switched off at once.</li>
        </ul>
      </Card>

      <Card title="Reputation weights (off-chain)" icon={Scale}>
        <p className="text-sm leading-relaxed text-muted">
          The contract counts every reporter equally. This site also shows a reputation-weighted score computed from each reporter wallet&apos;s public history:
        </p>
        <p className="my-3 rounded-lg bg-card2/60 p-3 font-mono text-xs text-ink2">
          weight = {WEIGHT_FLOOR} + 0.9 × (0.5 × age + 0.5 × activity) × restraint
        </p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>age: days since the first transaction, full credit at {FULL_AGE_DAYS} days.</li>
          <li>activity: transactions seen, on a log scale, full credit at {FULL_ACTIVITY_TXS}.</li>
          <li>restraint: 1 up to {SPAM_FREE_REPORTS} live signals, then falling as a reporter sprays signals at many addresses.</li>
        </ul>
        <WeightCalculator />
        <p className="mt-3 text-xs text-faint">
          See a real reporter&apos;s breakdown on the <Link className="underline" to="/registry">Registry</Link> pages.
        </p>
      </Card>

      <Card title="Honest limits" icon={TriangleAlert}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
          {LIMITS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
