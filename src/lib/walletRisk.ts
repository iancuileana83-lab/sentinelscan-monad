import type { RiskLevel } from '../types.ts';

export interface WalletTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  contractAddress?: string;
  functionName?: string;
}

export interface WalletToken {
  contractAddress: string;
  name: string;
  symbol: string;
  balance: string;
  decimals: string;
}

export interface WalletContractInteraction {
  address: string;
  count: number;
}

export interface WalletData {
  address: string;
  network: string;
  txCount: number;
  tokenCount: number;
  transactions: WalletTx[];
  tokens: WalletToken[];
  contractInteractions: WalletContractInteraction[];
  firstSeen?: string;
  lastActive?: string;
}

export interface WalletRiskFactor {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface WalletRiskAssessment {
  score: number;
  level: RiskLevel;
  suspiciousInteractions: { address: string; reason: string }[];
  suspiciousContracts: { address: string; reason: string }[];
  riskFactors: WalletRiskFactor[];
}

const KNOWN_RISKY_PATTERNS = [
  '0x0000000000000000000000000000000000000000',
];

export function assessWalletRisk(data: WalletData): WalletRiskAssessment {
  let score = 0;
  const riskFactors: WalletRiskFactor[] = [];
  const suspiciousInteractions: { address: string; reason: string }[] = [];
  const suspiciousContracts: { address: string; reason: string }[] = [];

  if (data.txCount === 0) {
    return {
      score: 50,
      level: 'caution',
      suspiciousInteractions: [],
      suspiciousContracts: [],
      riskFactors: [
        {
          title: 'No Transaction History',
          description:
            'This wallet has zero on-chain transactions. It may be a newly created wallet or an inactive address.',
          severity: 'medium',
        },
      ],
    };
  }

  if (data.txCount > 0 && data.txCount <= 5) {
    score += 25;
    riskFactors.push({
      title: 'Very Low Activity',
      description: `Only ${data.txCount} transactions found. Low-activity wallets can indicate throwaway or newly created addresses.`,
      severity: 'medium',
    });
  } else if (data.txCount <= 20) {
    score += 10;
    riskFactors.push({
      title: 'Low Activity',
      description: `${data.txCount} transactions found. Relatively new or low-activity wallet.`,
      severity: 'low',
    });
  }

  if (data.txCount > 500) {
    score += 15;
    riskFactors.push({
      title: 'Very High Transaction Volume',
      description: `${data.txCount} transactions detected. Extremely high activity may indicate an exchange hot wallet, bot, or automated contract.`,
      severity: 'medium',
    });
  }

  const contractSet = new Set<string>();
  for (const tx of data.transactions) {
    if (tx.to && tx.to !== data.address) contractSet.add(tx.to);
    if (tx.from && tx.from !== data.address) contractSet.add(tx.from);
  }

  for (const pattern of KNOWN_RISKY_PATTERNS) {
    if (contractSet.has(pattern)) {
      score += 30;
      suspiciousInteractions.push({
        address: pattern,
        reason: 'Interaction with null/burn address detected',
      });
      riskFactors.push({
        title: 'Null Address Interaction',
        description:
          'Wallet has interacted with the null address (0x000...000), which is associated with token burns or contract creation exploits.',
        severity: 'high',
      });
    }
  }

  const highFreqContracts = data.contractInteractions.filter(
    (c) => c.count >= 10
  );
  if (highFreqContracts.length > 0) {
    score += Math.min(highFreqContracts.length * 5, 20);
    for (const c of highFreqContracts.slice(0, 5)) {
      suspiciousContracts.push({
        address: c.address,
        reason: `${c.count} interactions with this address — high-frequency counterparty`,
      });
    }
    riskFactors.push({
      title: 'High-Frequency Counterparty Concentration',
      description: `${highFreqContracts.length} address(es) interacted with 10+ times. Concentrated activity may indicate a single dependency or automated system.`,
      severity: 'medium',
    });
  }

  const uniqueCounterparties = data.contractInteractions.length;
  if (uniqueCounterparties === 1 && data.txCount > 10) {
    score += 20;
    riskFactors.push({
      title: 'Single Counterparty Dependency',
      description:
        'All activity goes to or from a single address. This can be a funnel setup, but it is just as common for bots, payout and system accounts.',
      severity: 'high',
    });
  }

  const recentTxs = data.transactions.slice(0, 10);
  let allOutgoing = true;
  for (const tx of recentTxs) {
    if (tx.from !== data.address) {
      allOutgoing = false;
      break;
    }
  }
  if (allOutgoing && recentTxs.length >= 5) {
    score += 15;
    riskFactors.push({
      title: 'One-Way Outflow Pattern',
      description:
        'Recent transactions are all outgoing, with no incoming funds. This can be a draining pattern, but also a bot or payout account.',
      severity: 'high',
    });
  }

  if (data.tokenCount > 50) {
    score += 10;
    riskFactors.push({
      title: 'Large Token Portfolio',
      description: `${data.tokenCount} different tokens held. Very large portfolios can indicate a spam token receiver or airdrop farmer.`,
      severity: 'low',
    });
  }

  if (data.firstSeen) {
    const firstDate = new Date(data.firstSeen);
    const daysSinceCreation =
      (Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 7) {
      score += 25;
      riskFactors.push({
        title: 'Very Recent Wallet',
        description: `Wallet first seen ${Math.round(daysSinceCreation)} days ago. New wallets carry higher uncertainty.`,
        severity: 'high',
      });
    } else if (daysSinceCreation < 30) {
      score += 10;
      riskFactors.push({
        title: 'Recently Created Wallet',
        description: `Wallet first seen ${Math.round(daysSinceCreation)} days ago. Recently created wallets have limited reputation history.`,
        severity: 'medium',
      });
    }
  }

  if (riskFactors.length === 0) {
    riskFactors.push({
      title: 'No Significant Risk Patterns',
      description:
        'Transaction history shows normal activity patterns with no suspicious indicators detected.',
      severity: 'low',
    });
  }

  score = Math.min(score, 100);

  const level: RiskLevel =
    score < 40 ? 'safe' : score < 70 ? 'caution' : 'danger';

  return {
    score,
    level,
    suspiciousInteractions,
    suspiciousContracts,
    riskFactors,
  };
}
