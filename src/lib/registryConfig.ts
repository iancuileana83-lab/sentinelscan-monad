// Public facts about the deployed contract. Nothing secret lives here.
// The address must match deployments/monad-testnet.json (checked by a test).
export const REGISTRY_ADDRESS = '0xb0C3Be753788a5962DE52db929f49df02700AFd4';

// GuardedPay: pays only after reading RiskRegistry (see contracts/GuardedPay.sol).
export const GUARD_ADDRESS = '0x6e124EB8B980ae3e1CB79f856b8dC0d6F691d5bD';
export const GUARD_POLICY = { confirmScore: 40, blockScore: 70, minReportersToConfirm: 1, minReportersToBlock: 2 } as const;

// RiskAwarePayout: an example contract that builds on RiskRegistry and GuardedPay (see contracts/examples).
export const EXAMPLE_ADDRESS = '0x2145308E2932D126d461A4c1Aa583bF2cdf21e7e';

// A fresh address created for the demo (its key was discarded). Two test wallets recorded signals about it.
export const DEMO_TARGET = '0x3dc0Cc8bc1BbED963Fc2841b9a975Ab933A94F42';

/** Friendly names for addresses this app knows about. Everything else is shown as a plain address. */
export const KNOWN_LABELS: Record<string, string> = {
  [REGISTRY_ADDRESS.toLowerCase()]: 'RiskRegistry contract',
  [GUARD_ADDRESS.toLowerCase()]: 'GuardedPay contract',
  [EXAMPLE_ADDRESS.toLowerCase()]: 'RiskAwarePayout (example contract)',
  [DEMO_TARGET.toLowerCase()]: 'Demo address (made for this demo)',
  '0x0228ba8c75b9eaf02fa06872028da9754b2c8874': 'Demo test reporter',
  '0x0c6b75389a0d48f2eb16cc91022728fb6cbe7fc5': 'Project test wallet',
  '0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e': 'System account (staking rewards)',
};
export const labelFor = (address: string): string | undefined => KNOWN_LABELS[address.toLowerCase()];

export const MONAD_TESTNET = {
  chainId: 10143,
  chainIdHex: '0x279f',
  name: 'Monad Testnet',
  rpcUrl: 'https://rpc-testnet.monadinfra.com',
  explorer: 'https://testnet.monadscan.com',
  currency: { name: 'Monad', symbol: 'MON', decimals: 18 },
} as const;

export const explorerAddressUrl = (address: string) => `${MONAD_TESTNET.explorer}/address/${address}`;
export const explorerTxUrl = (hash: string) => `${MONAD_TESTNET.explorer}/tx/${hash}`;

// Shared vocabulary stored on-chain next to each score (see RiskRegistry.sol).
export const REASON_LABELS = [
  'Other',
  'Very new wallet',
  'High-frequency counterparty',
  'Single counterparty',
  'One-way outflow',
  'Null-address interaction',
  'Failed or unusual transaction',
  'Contract deployment',
  'Large transfer',
] as const;

const SEVERITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 } as const;

const TITLE_TO_CODE: Record<string, number> = {
  'Very Recent Wallet': 1,
  'Recently Created Wallet': 1,
  'High-Frequency Counterparty Concentration': 2,
  'Single Counterparty Dependency': 3,
  'One-Way Outflow Pattern': 4,
  'Null Address Interaction': 5,
  'Failed Transaction': 6,
  'Contract Deployment': 7,
  'Large Native Transfer': 8,
  'Large Token Transfers': 8,
};

/** The reason code of the most severe factor; 0 ("Other") when nothing maps. */
export function pickReasonCode(factors: { title: string; severity: keyof typeof SEVERITY_ORDER }[]): number {
  let best = { code: 0, rank: -1 };
  for (const f of factors) {
    const code = TITLE_TO_CODE[f.title];
    if (code === undefined) continue;
    const rank = SEVERITY_ORDER[f.severity];
    if (rank > best.rank) best = { code, rank };
  }
  return best.code;
}
