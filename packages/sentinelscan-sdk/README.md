# sentinelscan-sdk

Check an address on **Monad Testnet** in three lines. Read-only: the SDK never signs or sends anything.

```ts
import { SentinelScan } from 'sentinelscan-sdk';

const sentinel = new SentinelScan();                       // public deployment by default
const check = await sentinel.check('0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e');

console.log(check.score, check.level);                     // 65 'caution'
console.log(check.registry.reporterCount, check.registry.reputationWeighted?.weightedAverage);
console.log(check.guard.decision, check.suggestion);       // 'confirm' 'ask-a-human'
```

`check()` runs the three reads below in parallel. You can call them one by one:

| Method | Returns |
|---|---|
| `scanWallet(address)` | 0 to 100 risk signal, the signals with explanations, facts, evidence (latest 100 transactions) |
| `scanTransaction(hash)` | risk signal and facts for one transaction |
| `registrySignals(address)` | reporters, plain average and reputation-weighted average from `RiskRegistry` |
| `guardQuote(address)` | what `GuardedPay` would do for a payment: `allow`, `confirm` or `block` |

Also exported: `CONTRACTS` (verified addresses), `RISK_REGISTRY_ABI`, `GUARDED_PAY_ABI` (human-readable, for ethers or viem),
`REASON_LABELS`, and typed results. Errors are `SentinelScanError` (with the HTTP status when there is one).

A score is a signal about patterns in public on-chain data, **never a verdict**. `suggestion` is a hint derived from the
on-chain guard: `proceed`, `ask-a-human` or `stop`.

## Use the contracts from your own contract

See `contracts/interfaces/` and `contracts/examples/RiskAwarePayout.sol` in the repository: a contract that reads
`RiskRegistry` with its own policy and also forwards a payment through `GuardedPay`.

## Install

Not on npm yet. From a clone of https://github.com/iancuileana83-lab/sentinelscan-monad:

```bash
npm install ./packages/sentinelscan-sdk
```

The built files are committed in `dist/`; `npm run build` in the package folder rebuilds them. MIT licensed. Testnet only.
