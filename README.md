# SentinelScan on Monad

Risk **signals** for wallets and transactions on **Monad Testnet**, a public on-chain registry where anyone
can record a signal, a guard contract that reads the registry before it forwards a payment, a live block
radar, and read-only tools plus a real AI agent that checks an address before paying it. Built for the
Monad Metropolis hackathon, track *Trust, Identity & AI Infrastructure*.

**Live app:** https://monad-risk-signals.vercel.app (backup address: https://sentinelscan-monad.vercel.app)

> **Testnet only.** Everything here runs on Monad Testnet (chain ID 10143). Testnet MON has no
> real value, and the app never asks for real money. A score is a **signal, not a verdict**.

## Try it in three minutes (no wallet needed)

1. **Scanner**: press *System account*. You get a 65/100 "Caution" with the reasons. It is a Monad system account that pays staking rewards, which is exactly why a score is not a verdict.
2. **Address page** for the demo address (`/address/0x3dc0…4F42`): two test reporters recorded high scores, so the on-chain **GuardedPay** card says *Blocked*.
3. **For AI agents** → *Run the agent* on the same address: a real model calls our tools, reads numbered evidence and refuses with cited reasons. It never sends money.
4. **Live radar**: new blocks stream in, a few per second.

Recording a signal or trying a guarded payment needs a browser wallet and testnet MON (free from https://faucet.monad.xyz).
Note for judges: some wallets may flag this new `vercel.app` preview domain. That is a false positive that has been
reported for review. Everything except those two wallet actions works without a wallet, the contracts and the source are
verified and public, and if you do connect a wallet, please use a throwaway testnet account.

## The app

| Page | What it is |
|---|---|
| **Scanner** `/` | Scan a wallet or transaction; examples to try; no wallet needed; optional AI analyst notes that cite evidence |
| **Registry** `/registry` | Everything recorded in RiskRegistry, rebuilt from its events: stats, activity and score charts, most-reported addresses, recent activity |
| **Address** `/address/0x…` | A shareable page for one address: scan, public signals (plain and reputation-weighted), the GuardedPay decision, full history |
| **Reporter** `/reporter/0x…` | One reporter's weight, how it is built, and everything they recorded or retracted |
| **Live radar** `/radar` | New blocks as they arrive, with quick hints: payments to addresses that have live registry signals, null-address sends, self-transfers, very large transfers |
| **For AI agents** `/agents` | The read-only MCP and JSON tools, a live playground, and a real model-driven agent that decides whether to pay an address and cites evidence |
| **How it works** `/how-it-works` | Every scoring rule with its points, the guard policy, the reputation formula with a calculator, and the honest limits |

## Contracts (Monad Testnet, source verified)

| Contract | Address | What it does |
|---|---|---|
| **RiskRegistry** | [`0xb0C3Be753788a5962DE52db929f49df02700AFd4`](https://testnet.monadscan.com/address/0xb0C3Be753788a5962DE52db929f49df02700AFd4#code) | A public notice board: anyone records a score (0 to 100) and one reason code about an address |
| **GuardedPay** | [`0x6e124EB8B980ae3e1CB79f856b8dC0d6F691d5bD`](https://testnet.monadscan.com/address/0x6e124EB8B980ae3e1CB79f856b8dC0d6F691d5bD#code) | Forwards a payment only after reading the registry |

### RiskRegistry

- One live signal per (reporter, subject). Reporting again **updates** your own signal instead of adding another, so a single wallet cannot inflate the count.
- A reporter can **retract** their own signal. Nobody can change or remove anyone else's.
- Reasons are a fixed list of codes (new wallet, one-way outflow, and so on). There is no free text, so the contract cannot be used to publish accusations.
- No owner, no admin, no fees, no funds held, no upgrade path. You cannot record a signal about your own address or the zero address.

Honest limit: anyone can use many wallets, so the reporter count is a hint, not proof.

### GuardedPay

`pay(recipient, acknowledgeRisk)` forwards the attached MON only after reading RiskRegistry:

| Registry says | What happens |
|---|---|
| average score below 40, or nobody reported | allowed |
| average from 40 with 1+ reporter | reverts unless `acknowledgeRisk` is true |
| average from 70 with 2+ reporters | refused, even if acknowledged |

One reporter alone can never block a payment. No owner, no custody, no state. `quote(recipient)` shows the decision
without sending anything, and agents get it as the read-only `guard_quote` tool. Checked on testnet with the scripts in
`scripts/`: a blocked demo address, a confirmation-required system account and an allowed payment.

The demo address `0x3dc0…4F42` was generated for this demo (its key was discarded) and two test wallets recorded signals about it, so the "Blocked" case can be shown. It is labelled as a demo in the app.

## For AI agents: read-only tools (MCP and JSON)

Four tools, all **read-only**: an agent cannot sign or send anything with them, and none of them records a signal.

| Tool | What it returns |
|---|---|
| `scan_wallet` | 0-100 risk signal, the individual signals, facts, and evidence (recent transaction hashes, top counterparties) |
| `scan_transaction` | 0-100 risk signal, the signals and facts for one transaction |
| `get_registry_signals` | Reporters in `RiskRegistry`, plain and reputation-weighted averages, last report time |
| `guard_quote` | What GuardedPay would do for an address right now: allow, confirm or block |

- **MCP server** (Streamable HTTP, stateless): `https://monad-risk-signals.vercel.app/api/mcp`
- **Plain JSON**: `GET /api/agent-tools` returns the tool list with JSON schemas, and `POST /api/agent-tools` with `{"tool": "scan_wallet", "arguments": {"address": "0x..."}}` calls one.

```bash
claude mcp add --transport http sentinelscan-monad https://monad-risk-signals.vercel.app/api/mcp
node examples/agent-demo.mjs        # a scripted MCP client (no language model)
```

### The AI agent and the analyst

On the *For AI agents* page a real language model (Gemini through an OpenAI-compatible client; Qwen is also supported) is asked whether to pay an address. It chooses which tools to call, reads **numbered evidence** (E1, E2, ...), and answers *pay*, *ask a human* or *refuse* with reasons that cite evidence ids. The analyst on wallet scans writes short notes the same way.

Safety, enforced in code and covered by tests with a fake model:

- The agent never sends money; it only shows the call it would make.
- It cannot override the on-chain guard: a blocked address is always refused and a confirmation-needed one always goes to a human. The guard is consulted even if the model forgets.
- Every cited evidence id must exist; claims that cite nothing real are dropped, and a failed or off-script model falls back to a plain answer built from the same evidence.
- Token names, symbols and other text chosen by contract deployers never reach the model (they could carry instructions). The agent can only look at the address it was asked about and only at the read-only tools.
- Limits: per visitor per hour and per day, a global daily cap, ten-minute caching, a kill switch (`AI_DISABLED=1`), and a free-tier key without billing as the hard cap. The in-memory limits are best effort because serverless instances do not share memory.

## Reputation-weighted signals (off-chain, no contract change)

The contract counts every reporter equally. The app and the agent tools also show a **reputation-weighted score**, computed off-chain from public data, so cheap spam counts for less:

`weight = 0.1 + 0.9 × (0.5 × age + 0.5 × activity) × restraint`

- **age**: days since the reporter's first transaction, full credit at 30 days;
- **activity**: transactions seen (up to the latest 100), full credit at 50, on a log scale;
- **restraint**: 1 for up to 10 live signals recorded across all addresses, then falling (never below 0.2 in the formula).

A brand-new, silent wallet still counts, at the floor weight of 0.1. Each live signal is confirmed against the contract itself; the event history is only used to list reporters. This is a heuristic: patient attackers can age wallets, so it weakens cheap spam but cannot prevent it. The formula lives in `server/reputation.ts`, with tests.

## Powered by Envio HyperSync

With a free Envio token configured (`ENVIO_API_TOKEN`), two core features read their data through **Envio HyperSync**:

- the **registry history**: every `SignalRecorded` and `SignalRetracted` event, which drives the Registry Explorer, address history, reporter weights, and the agent's evidence;
- the **live radar**: blocks and transactions in real time (HyperSync tracks the chain head, and one query returns a whole batch of blocks in a few hundred milliseconds).

The Etherscan API V2 and the public Monad RPCs remain automatic fallbacks, so the app still works if HyperSync is unavailable. The Registry page states which source it used.

## What's new for Metropolis

SentinelScan started earlier as an Ethereum and Arbitrum scanner,
[sentinelscan-web3-fraud-scanner](https://github.com/iancuileana83-lab/sentinelscan-web3-fraud-scanner).
That project was built before the hackathon and is **not** what is submitted here. This repository is a new, standalone app. What is reused and what is new:

**Reused (ported from the earlier repo, credited here)**

- The rule-based scoring logic: `src/lib/walletRisk.ts`, `src/lib/txRisk.ts`, `src/lib/riskExplainer.ts`, and the explainer component. Changes made here: Monad wording, relative imports, and softer wording on several signals so they read as signals, not accusations. The gauge was redesigned.

**New, written during the build window**

- Everything that touches Monad: the data layer (`server/monad.ts`), Etherscan API V2 for chain 10143 plus public RPCs with fallback, and Envio HyperSync.
- **Two smart contracts**, RiskRegistry (8 tests) and GuardedPay (11 tests), deploy scripts that refuse any network other than Monad Testnet, verification, and a seeding script for the demo address.
- The wallet flow (connect, switch or add Monad Testnet, record, retract, guarded payment), loaded only when a visitor clicks a wallet button.
- A new standalone, multi-page app and backend (serverless functions that keep keys on the server), a violet design with light and dark modes.
- **Read-only AI-agent tools** (MCP and JSON), a real **AI payment agent** and **analyst** with evidence citations, limits and tests.
- **Reputation-weighted signals**, the **Registry Explorer**, address and reporter pages, and the **live risk radar**.
- 54 app tests (scoring and every rule on the How-it-works page, agent safety with a fake model, limits, weighting, radar, HyperSync parsing) and 19 contract tests.

## How it works

```
Browser (React + Vite, light/dark)
   │  pages: Scanner · Registry · Address · Reporter · Radar · Agents · How it works
   ▼
Serverless functions in /api  (explorer key, AI key and Envio token stay on the server)
   ├─► Envio HyperSync ........ registry events, new blocks and transactions
   ├─► Etherscan API V2 ....... wallet history, token transfers (and event fallback)
   ├─► Monad Testnet RPC ...... transactions, receipts, contract reads (and block fallback)
   └─► Gemini (or Qwen) ....... the agent and the analyst, only ever fed numbered evidence
Browser wallet ──signs──► RiskRegistry / GuardedPay on Monad Testnet
```

Wallet scans look at the **latest 100 transactions**, not the complete history.

## Run it yourself

You need Node 22 or newer.

```bash
npm install
cp .env.example .env     # fill in ETHERSCAN_API_KEY (free, https://etherscan.io/myapikey)
npm run dev              # http://localhost:5173
```

Optional settings in `.env`: `GEMINI_API_KEY` (or `QWEN_API_KEY`) for the AI parts, `ENVIO_API_TOKEN` for HyperSync, `DEPLOYER_PRIVATE_KEY` only to deploy contracts (a throwaway testnet key, never committed).

```bash
npm run typecheck
npm test                 # 54 app tests, no network needed
npm run test:contract    # 19 contract tests on a local in-memory chain
npx hardhat run scripts/deploy.cjs --network monadTestnet        # RiskRegistry
npx hardhat run scripts/deploy-guard.cjs --network monadTestnet   # GuardedPay
```

Hosting: the repo deploys to Vercel as is. Set the environment variables in the project settings. The functions in `api/` are generated by `npm run build:api` from `api-src/` and committed, so hosting does not depend on how a host compiles TypeScript.

## Known limits

- Monad Testnet was reset in December 2025, so almost every wallet counts as "recent" and the *very new wallet* signal fires often. Treat it as weak evidence. Real testnet traffic is mostly bots, so many wallets land in "Caution".
- The rules are hand-written heuristics, not a trained model, and are tuned for demonstration. Wallet analysis covers the latest 100 transactions only.
- The registry is permissionless and testnet-only. It can contain careless or hostile opinions, which is why it stores scores and reason codes, not accusations. The guard uses the plain on-chain average, so many wallets could still sway it.
- AI output can be wrong. It is limited to numbered evidence and checked for citations, but it is a reading aid, never a verdict.
- The free Envio token covers HyperSync but not HyperRPC, so block data comes through HyperSync queries.
- Not audited. Do not use it with real funds. Not affiliated with Monad Labs.

## Credits and license

Built by Ileana Mazilu, with the help of Claude Code (an AI coding assistant) for implementation.
The scoring logic comes from the earlier SentinelScan project by the same author.

[MIT](LICENSE)
