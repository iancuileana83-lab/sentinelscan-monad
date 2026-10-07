# Security notes

SentinelScan on Monad is an open-source hackathon project that runs on **Monad Testnet only**
(chain ID 10143). Testnet tokens have no value.

## What the website can ask your wallet to do

Only these, and only after you click a button and approve it in your wallet:

| Action | Call | Contract |
|---|---|---|
| Record or update your signal about an address | `report(address, score, reasonCode)` | RiskRegistry `0xb0C3Be753788a5962DE52db929f49df02700AFd4` |
| Retract your own signal | `retract(address)` | RiskRegistry |
| Try a test payment through the guard | `pay(recipient, acknowledgeRisk)` with a small amount of test MON | GuardedPay `0x6e124EB8B980ae3e1CB79f856b8dC0d6F691d5bD` |

It also asks the wallet to switch to, or add, Monad Testnet. The site **never** asks for token approvals
or allowances, signatures that move funds, seed phrases, private keys or passwords. It does not request
wallet access when the page loads: the wallet code is only loaded after you click a wallet button.

## The contracts

- Both are verified on the Monad Testnet explorer, with the source in `contracts/` and tests in `test/`.
- Neither has an owner, an admin or an upgrade path. Neither can take funds: RiskRegistry holds nothing and rejects funds sent to it, and GuardedPay forwards the attached MON to the recipient in the same transaction and keeps nothing.

## Keys and data

- The explorer key, the AI key and the Envio token live only in server environment variables (Vercel secrets). They are not in the repository or in the page. `.env` is git-ignored, and every commit is scanned for them.
- The deployer key used to publish the contracts belongs to a throwaway testnet wallet.
- The app does not collect accounts, emails or analytics.

## The AI parts

- The AI agent and analyst only receive numbered evidence from our own scan and the public registry. Text chosen by contract deployers (token names and similar) is never passed to the model.
- The agent cannot send money, and it cannot override the on-chain guard. The tools it can call are read-only.

## Reporting a problem

Open an issue on https://github.com/iancuileana83-lab/sentinelscan-monad or contact the author, Ileana Mazilu, through GitHub.
