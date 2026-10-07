// Public facts about the deployed contract. Nothing secret lives here.
// The address must match deployments/monad-testnet.json (checked by a test).
export const REGISTRY_ADDRESS = '0xb0C3Be753788a5962DE52db929f49df02700AFd4';

export const REGISTRY_ABI = [
  'function report(address subject, uint8 score, uint8 reasonCode)',
  'function retract(address subject)',
  'function getSummary(address subject) view returns (uint32 reporterCount, uint8 averageScore, uint64 lastReportedAt)',
  'function getSignal(address subject, address reporter) view returns (uint8 score, uint8 reasonCode, uint64 reportedAt)',
] as const;

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
