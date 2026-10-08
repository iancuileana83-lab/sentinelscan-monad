import { useState } from 'react';
import { Code2 } from 'lucide-react';
import CodeBlock from '@/components/CodeBlock';
import { Card } from '@/components/Card';
import { EXAMPLE_ADDRESS, GUARD_ADDRESS, REGISTRY_ADDRESS, explorerAddressUrl } from '@/lib/registryConfig';

const REPO = 'https://github.com/iancuileana83-lab/sentinelscan-monad';

const TABS = [
  {
    id: 'sdk',
    label: 'TypeScript SDK',
    intro: 'Three lines to check an address: the risk signal, the public registry signals and the on-chain guard decision. Read-only, no dependencies.',
    code: `import { SentinelScan } from 'sentinelscan-sdk';

const sentinel = new SentinelScan();
const check = await sentinel.check('0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e');

console.log(check.score, check.level);                 // 65 'caution'
console.log(check.registry.reporterCount);             // reporters in RiskRegistry
console.log(check.guard.decision, check.suggestion);   // 'confirm' 'ask-a-human'`,
    note: 'Also: scanWallet, scanTransaction, registrySignals, guardQuote, plus the contract addresses and ABIs. Install from a clone: npm install ./packages/sentinelscan-sdk',
  },
  {
    id: 'read',
    label: 'Solidity: read the registry',
    intro: 'Apply your own rule on top of the public registry. The numbers are opinions of anonymous wallets, so use them as a reason to look closer, not as proof.',
    code: `import {ISentinelRegistry} from "./interfaces/ISentinelRegistry.sol";

ISentinelRegistry constant REGISTRY = ISentinelRegistry(${REGISTRY_ADDRESS});

function isFlagged(address who) public view returns (bool) {
    (uint32 reporters, uint8 average, ) = REGISTRY.getSummary(who);
    return reporters >= 2 && average >= 60;   // your policy, your numbers
}`,
    note: 'Interface: contracts/interfaces/ISentinelRegistry.sol',
  },
  {
    id: 'guard',
    label: 'Solidity: pay through the guard',
    intro: 'Forward a payment through GuardedPay so its fixed rule is enforced on-chain, or ask it what it would do first.',
    code: `import {ISentinelGuard} from "./interfaces/ISentinelGuard.sol";

ISentinelGuard constant GUARD = ISentinelGuard(${GUARD_ADDRESS});

function payOut(address payable to, bool acknowledgeRisk) external payable {
    // reverts with Blocked(...) or ConfirmationRequired(...) when the registry says so
    GUARD.pay{value: msg.value}(to, acknowledgeRisk);
}

function preview(address to) external view returns (ISentinelGuard.Decision) {
    (ISentinelGuard.Decision d, , ) = GUARD.quote(to);
    return d;                                  // Allow, Confirm or Block
}`,
    note: 'Interface: contracts/interfaces/ISentinelGuard.sol. A complete, tested example of both patterns: contracts/examples/RiskAwarePayout.sol',
  },
  {
    id: 'ethers',
    label: 'ethers, no SDK',
    intro: 'Read the registry and the guard straight from the chain.',
    code: `import { Contract, JsonRpcProvider } from 'ethers';

const provider = new JsonRpcProvider('https://rpc-testnet.monadinfra.com', 10143);
const registry = new Contract('${REGISTRY_ADDRESS}',
  ['function getSummary(address) view returns (uint32 reporterCount, uint8 averageScore, uint64 lastReportedAt)'], provider);
const guard = new Contract('${GUARD_ADDRESS}',
  ['function quote(address) view returns (uint8 decision, uint8 averageScore, uint32 reporters)'], provider);

const [reporters, average] = await registry.getSummary('0x...');
const [decision] = await guard.quote('0x...');   // 0 allow, 1 confirm, 2 block`,
    note: 'Both contracts are verified on the Monad Testnet explorer.',
  },
] as const;

export default function DeveloperGuide() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('sdk');
  const current = TABS.find((t) => t.id === tab)!;
  return (
    <Card title="For developers: build on it" icon={Code2}>
      <p className="text-sm leading-relaxed text-muted">
        SentinelScan is meant to be infrastructure, not just an app. Any Monad app, contract or agent can read the same signals: from TypeScript with the SDK, from Solidity with two small interfaces, or with plain
        ethers. Everything is MIT licensed and testnet only.
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Developer examples">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => setTab(t.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              t.id === tab ? 'border-brand/40 bg-brand/10 text-brand-ink' : 'border-line text-muted hover:bg-card2'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{current.intro}</p>
      <div className="mt-2">
        <CodeBlock label={current.label} code={current.code} />
      </div>
      <p className="mt-2 text-xs text-faint">{current.note}</p>
      <p className="mt-4 text-xs leading-relaxed text-faint">
        Source and tests:{' '}
        <a className="underline" href={`${REPO}/tree/main/packages/sentinelscan-sdk`} target="_blank" rel="noreferrer">
          SDK
        </a>
        ,{' '}
        <a className="underline" href={`${REPO}/tree/main/contracts`} target="_blank" rel="noreferrer">
          interfaces and example
        </a>
        . Live example contract, source verified:{' '}
        <a className="underline" href={explorerAddressUrl(EXAMPLE_ADDRESS)} target="_blank" rel="noreferrer">
          RiskAwarePayout
        </a>
        .
      </p>
    </Card>
  );
}
