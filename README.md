# SentinelScan on Monad

A wallet and transaction risk scanner for **Monad Testnet**, with a small public contract
where anyone can record a risk **signal** about an address. Built for the Monad Metropolis
hackathon, track *Trust, Identity & AI Infrastructure*.

**Live app:** https://sentinelscan-monad.vercel.app

> **Testnet only.** Everything here runs on Monad Testnet (chain ID 10143). Testnet MON has no
> real value, and the app never asks for real money.

## The app

| Page | What it is |
|---|---|
| **Scanner** `/` | Scan a wallet or transaction; examples to try; no wallet needed |
| **Registry** `/registry` | Everything recorded in RiskRegistry, rebuilt from its events: stats, most-reported addresses, recent activity |
| **Address** `/address/0x…` | A shareable page for one address: scan, public signals (plain and reputation-weighted), full history |
| **Reporter** `/reporter/0x…` | One reporter's weight, how it is built, and everything they recorded or retracted |
| **For AI agents** `/agents` | The read-only MCP and JSON tools, with a live playground |
| **How it works** `/how-it-works` | Every scoring rule with its points, the reputation formula with a calculator, and the honest limits |

## What it does

1. **Scan a wallet or a transaction** on Monad Testnet. You get a 0 to 100 score, the signals
   behind it (for example "very new wallet" or "one-way outflow"), and a plain-language
   explanation that separates facts read from the chain from the interpretation of them.
2. **See what the chain already knows.** Under every wallet scan, the app reads the
   `RiskRegistry` contract and shows how many reporters have recorded a signal for that address,
   their average score and the date of the last report.
3. **Record your own signal.** Connect a wallet (MetaMask or similar), press *Record on Monad*,
   and your score and main reason are stored on-chain. Recording again updates your signal, and
   *Retract mine* removes it.

Scores describe how likely a pattern is to be risky. They are **signals, not verdicts**, and not
financial advice. A "Caution" score is just as likely to be a bot, a payout account or a system
account as anything harmful.

## The on-chain piece: `RiskRegistry`

| | |
|---|---|
| Network | Monad Testnet (10143) |
| Address | [`0xb0C3Be753788a5962DE52db929f49df02700AFd4`](https://testnet.monadscan.com/address/0xb0C3Be753788a5962DE52db929f49df02700AFd4#code) (source verified) |
| Source | [`contracts/RiskRegistry.sol`](contracts/RiskRegistry.sol) |

Design, kept deliberately small:

- One live signal per (reporter, subject). Reporting again **updates** your own signal instead of
  adding another, so a single wallet cannot inflate the count.
- A reporter can **retract** their own signal. Nobody can change or remove anyone else's.
- Reasons are a fixed list of codes (new wallet, one-way outflow, and so on). There is no free
  text, so the contract cannot be used to publish accusations.
- No owner, no admin, no fees, no funds held, no upgrade path. It rejects any native funds sent to it.
- You cannot record a signal about your own address or the zero address.

Honest limit: anyone can use many wallets, so the reporter count is a hint, not proof. This is a
demo of a public reputation primitive, not a trust oracle.

## For AI agents: read-only tools (MCP and JSON)

The same scanner is available to AI agents. Three tools, all **read-only**: an agent cannot sign
or send anything with them, and none of them records a signal on-chain.

| Tool | What it returns |
|---|---|
| `scan_wallet` | 0-100 risk signal, the individual signals, facts, and evidence (recent transaction hashes, top counterparties) |
| `scan_transaction` | 0-100 risk signal, the signals and facts for one transaction |
| `get_registry_signals` | How many reporters recorded a signal about an address in `RiskRegistry`, their average score, last report time |

- **MCP server** (Streamable HTTP, stateless): `https://monad-risk-signals.vercel.app/api/mcp`
- **Plain JSON**: `GET /api/agent-tools` returns the tool list with JSON schemas, and
  `POST /api/agent-tools` with `{"tool": "scan_wallet", "arguments": {"address": "0x..."}}` calls one.

Add it to Claude Code:

```bash
claude mcp add --transport http sentinelscan-monad https://monad-risk-signals.vercel.app/api/mcp
```

Run the scripted demo (an official MCP client discovers the tools, calls them and answers only
from the returned evidence; it uses no language model):

```bash
node examples/agent-demo.mjs
```

Safety choices: tool outputs carry a "signal, not verdict" notice; token symbols and other
on-chain text are cleaned and shortened because they are untrusted input; unexpected arguments are
rejected; requests are rate limited per client on a best-effort basis.

## Reputation-weighted signals (off-chain, no contract change)

The contract counts every reporter equally. The app and the agent tool also show a
**reputation-weighted score**, computed off-chain from public Monad Testnet data, so cheap spam counts for less:

`weight = 0.1 + 0.9 × (0.5 × age + 0.5 × activity) × restraint`

- **age**: days since the reporter's first transaction, full credit at 30 days;
- **activity**: transactions seen (up to the latest 100), full credit at 50, on a log scale;
- **restraint**: 1 for up to 10 live signals recorded across all addresses, then falling (never below 0.2 in the formula).

A brand-new, silent wallet still counts, at the floor weight of 0.1. The panel also shows the plain average and the
"effective reporters" number (how many equal reporters the weights are worth). Each live signal is confirmed against the
contract itself, and the event history is only used to list reporters. This is a heuristic: patient attackers can age
wallets, so it weakens cheap spam but cannot prevent it. The formula lives in `server/reputation.ts` and is covered by tests.

## What's new for Metropolis

SentinelScan started earlier as an Ethereum and Arbitrum scanner,
[sentinelscan-web3-fraud-scanner](https://github.com/iancuileana83-lab/sentinelscan-web3-fraud-scanner).
That project was built before the hackathon and is **not** what is submitted here. This repository
is a new, standalone app. What is reused and what is new:

**Reused (ported from the earlier repo, credited here)**

- The rule-based scoring logic: `src/lib/walletRisk.ts`, `src/lib/txRisk.ts`,
  `src/lib/riskExplainer.ts`, and the `RiskGauge` and `RiskExplainer` components. Changes made
  here: Monad wording, relative imports, and softer wording on two signals so they read as signals,
  not accusations.

**New, written during the build window**

- Everything that touches Monad: the data layer (`server/monad.ts`) using Etherscan API V2 for
  chain 10143 plus the public Monad Testnet RPCs with automatic fallback (one public RPC stalls on
  some calls).
- **The `RiskRegistry` smart contract**, its 8 tests, and a deploy script that refuses any network
  other than Monad Testnet.
- Reading the registry from the app (`server/registry.ts`) and the wallet flow: connect, switch or
  add Monad Testnet, record, retract (`src/lib/wallet.ts`, `src/components/RegistryPanel.tsx`).
- A new standalone app and backend. The earlier project depended on Supabase Edge Functions. This
  one uses a few small serverless functions in `api/` that keep the explorer key on the server.
- **Read-only AI-agent tools**: an MCP server and a JSON API with schemas (`server/tools.ts`, `server/mcp.ts`), plus a demo client (`examples/agent-demo.mjs`).
- **Reputation-weighted signals**: off-chain weights from reporter wallet history (`server/reputation.ts`, `server/events.ts`, `server/weighted.ts`), shown in the app and returned to agents.
- Tests for the scoring, the agent tools, the weighting and the app's contract address, and this documentation.

## How it works

```
Browser (React + Vite) ──► /api/wallet-scan, /api/tx-scan, /api/registry   (serverless, holds the explorer key)
        │                              │
        │ wallet signs                 ├─► Etherscan API V2, chainid 10143 (history, token transfers)
        ▼                              └─► Monad Testnet RPC (transactions, receipts, contract reads)
RiskRegistry on Monad Testnet
```

The explorer key never reaches the browser. Wallet scans look at the **latest 100 transactions**,
not the complete history.

## Run it yourself

You need Node 22 or newer.

```bash
npm install
cp .env.example .env     # then fill in ETHERSCAN_API_KEY (free, https://etherscan.io/myapikey)
npm run dev              # http://localhost:5173
```

Checks:

```bash
npm run typecheck
npm test                 # scoring and config tests
npm run test:contract    # contract tests on a local in-memory chain
```

Deploying your own copy of the contract (needs a throwaway testnet wallet and free MON from
https://faucet.monad.xyz; put its key in `.env` as `DEPLOYER_PRIVATE_KEY`, never commit it):

```bash
npx hardhat run scripts/deploy.cjs --network monadTestnet
```

Hosting: the repo deploys to Vercel as is. Set the `ETHERSCAN_API_KEY` environment variable in the
project settings. The functions in `api/` are generated by `npm run build:api` from `api-src/` and
committed, so hosting does not depend on how a host compiles TypeScript.

## Known limits

- Monad Testnet was reset in December 2025, so almost every wallet counts as "recent" and the
  *very new wallet* signal fires often. Treat it as weak evidence.
- Testnet has little real fraud. The scanner's rules are heuristics, not a trained model, and are
  tuned for demonstration.
- Wallet analysis covers the latest 100 transactions only.
- The registry is permissionless and testnet-only. It can contain careless or hostile opinions,
  which is why it stores scores and reason codes, not accusations.
- Not audited. Do not use it with real funds.

## Credits and license

Built by Ileana Mazilu, with the help of Claude Code (an AI coding assistant) for implementation.
The scoring logic comes from the earlier SentinelScan project by the same author.

[MIT](LICENSE)
