import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/Card';
import { LEVELS, LIMITS, TX_RULES, WALLET_RULES, type Rule } from '@/lib/rules';
import { MONAD_TESTNET, REASON_LABELS } from '@/lib/registryConfig';
// The same pure function the server uses, so the calculator below cannot disagree with the real weights.
import { FULL_ACTIVITY_TXS, FULL_AGE_DAYS, SPAM_FREE_REPORTS, WEIGHT_FLOOR, reputationWeight } from '../../server/reputation';

function RuleTable({ rules }: { rules: Rule[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs text-slate-500">
          <tr>
            <th className="pb-2 pr-3 font-medium">Pattern</th>
            <th className="pb-2 pr-3 font-medium">Points</th>
            <th className="pb-2 font-medium">When it applies</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.name} className="border-t border-slate-800 align-top">
              <td className="py-2 pr-3 text-slate-200">{r.name}</td>
              <td className="py-2 pr-3 whitespace-nowrap text-emerald-300">{r.points}</td>
              <td className="py-2 text-slate-400">{r.when}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Slider({ label, value, max, onChange, unit = '' }: { label: string; value: number; max: number; onChange: (n: number) => void; unit?: string }) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="flex justify-between">
        <span>{label}</span>
        <b className="text-slate-100">
          {value}
          {unit}
        </b>
      </span>
      <input className="mt-1 w-full accent-emerald-500" type="range" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
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
      <div className="rounded-xl bg-slate-800/50 p-4 text-sm text-slate-300">
        <div className="text-xs text-slate-500">Resulting weight</div>
        <div className="text-3xl font-semibold text-slate-100">{w.weight}</div>
        <ul className="mt-2 space-y-1 text-xs text-slate-400">
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
        <h1 className="text-xl font-semibold text-slate-100">How it works</h1>
        <p className="mt-1 text-sm text-slate-400">
          Everything on this site is a rule you can read. There is no hidden model behind the scores, and no score is a verdict.
        </p>
      </div>

      <Card title="The idea: signal, not verdict">
        <div className="space-y-2 text-sm leading-relaxed text-slate-400">
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

      <Card title="Score levels">
        <ul className="space-y-2 text-sm">
          {LEVELS.map((l) => (
            <li key={l.range} className="flex flex-wrap gap-x-3">
              <span className="w-24 font-medium text-slate-200">{l.range}</span>
              <span className="w-24 text-emerald-300">{l.label}</span>
              <span className="text-slate-400">{l.meaning}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Points add up and are capped at 100.</p>
      </Card>

      <Card title="Wallet rules">
        <RuleTable rules={WALLET_RULES} />
      </Card>

      <Card title="Transaction rules">
        <RuleTable rules={TX_RULES} />
      </Card>

      <Card title="Where the data comes from">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">
          <li>Wallet history, token transfers and contract events: the Etherscan API V2 for Monad Testnet (chain {MONAD_TESTNET.chainId}).</li>
          <li>Transactions, receipts, blocks and contract reads: public Monad Testnet RPC endpoints, with automatic fallback between three of them.</li>
          <li>The explorer key stays on the server. The browser never sees it.</li>
        </ul>
      </Card>

      <Card title="The public registry (RiskRegistry)">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">
          <li>One live signal per reporter and address. Recording again updates your own signal, so one wallet cannot inflate a count.</li>
          <li>Only the author can retract a signal. Nobody can change or remove someone else&apos;s.</li>
          <li>No owner, no admin, no fees, no funds held, no upgrade path. The source is verified on the explorer.</li>
          <li>You cannot report your own address or the zero address.</li>
        </ul>
      </Card>

      <Card title="Reputation weights (off-chain)">
        <p className="text-sm leading-relaxed text-slate-400">
          The contract counts every reporter equally. This site also shows a reputation-weighted score computed from each reporter wallet&apos;s public history:
        </p>
        <p className="my-3 rounded-lg bg-slate-800/60 p-3 font-mono text-xs text-slate-300">
          weight = {WEIGHT_FLOOR} + 0.9 × (0.5 × age + 0.5 × activity) × restraint
        </p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-slate-400">
          <li>age: days since the first transaction, full credit at {FULL_AGE_DAYS} days.</li>
          <li>activity: transactions seen, on a log scale, full credit at {FULL_ACTIVITY_TXS}.</li>
          <li>restraint: 1 up to {SPAM_FREE_REPORTS} live signals, then falling as a reporter sprays signals at many addresses.</li>
        </ul>
        <WeightCalculator />
        <p className="mt-3 text-xs text-slate-500">
          See a real reporter&apos;s breakdown on the <Link className="underline" to="/registry">Registry</Link> pages.
        </p>
      </Card>

      <Card title="Honest limits">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-400">
          {LIMITS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
