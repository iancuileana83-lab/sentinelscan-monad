import type { RiskLevel } from '../types.ts';

export interface TxTokenTransfer {
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
}

export interface TxInternalTx {
  from: string;
  to: string;
  value: string;
  type: string;
  input?: string;
}

export interface TxData {
  hash: string;
  network: string;
  blockNumber: number;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isSuccess: boolean;
  contractAddress: string | null;
  functionName: string | null;
  input: string;
  tokenTransfers: TxTokenTransfer[];
  internalTxs: TxInternalTx[];
  receiptStatus: string | null;
}

export interface TxRiskFactor {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  weight: number;
}

export interface TxRiskAssessment {
  score: number;
  level: RiskLevel;
  riskFactors: TxRiskFactor[];
  suspiciousAddresses: { address: string; reason: string }[];
  summary: string;
}

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

function formatValue(value: string, decimals = 18): string {
  const num = Number(value);
  if (isNaN(num)) return value;
  return (num / Math.pow(10, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
    maximumSignificantDigits: 6,
  });
}

export function assessTxRisk(data: TxData): TxRiskAssessment {
  let score = 0;
  const riskFactors: TxRiskFactor[] = [];
  const suspiciousAddresses: { address: string; reason: string }[] = [];

  if (!data.isSuccess) {
    score += 40;
    riskFactors.push({
      title: 'Failed Transaction',
      description:
        'This transaction was reverted or failed. Failed transactions can indicate a failed exploit attempt, a front-run, or a contract error during a suspicious interaction.',
      severity: 'high',
      weight: 40,
    });
  }

  if (data.to === null || data.to === '') {
    score += 25;
    riskFactors.push({
      title: 'Contract Deployment',
      description:
        'This transaction deploys a new contract rather than interacting with an existing one. Newly deployed contracts carry higher uncertainty as their behavior is not yet established.',
      severity: 'medium',
      weight: 25,
    });
  }

  const allAddresses = new Set<string>();
  if (data.from) allAddresses.add(data.from.toLowerCase());
  if (data.to) allAddresses.add(data.to.toLowerCase());
  for (const t of data.tokenTransfers) {
    if (t.from) allAddresses.add(t.from.toLowerCase());
    if (t.to) allAddresses.add(t.to.toLowerCase());
  }
  for (const t of data.internalTxs) {
    if (t.from) allAddresses.add(t.from.toLowerCase());
    if (t.to) allAddresses.add(t.to.toLowerCase());
  }

  if (allAddresses.has(NULL_ADDRESS)) {
    score += 30;
    suspiciousAddresses.push({
      address: NULL_ADDRESS,
      reason: 'Null address (0x000...000) involved — associated with token minting, burning, or contract creation',
    });
    riskFactors.push({
      title: 'Null Address Interaction',
      description:
        'The transaction involves the null address (0x000...000). This is associated with token minting, burning, or contract creation and warrants scrutiny.',
      severity: 'high',
      weight: 30,
    });
  }

  const nativeValue = Number(data.value);
  if (nativeValue > 0) {
    const ethValue = nativeValue / Math.pow(10, 18);
    if (ethValue > 100) {
      score += 20;
      riskFactors.push({
        title: 'Large Native Transfer',
        description: `This transaction transfers ${ethValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} MON (native token). Large value transfers carry higher financial risk if the transaction is malicious.`,
        severity: 'medium',
        weight: 20,
      });
    } else if (ethValue > 10) {
      score += 10;
      riskFactors.push({
        title: 'Moderate Native Transfer',
        description: `This transaction transfers ${ethValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} native tokens. The value is notable but not extreme.`,
        severity: 'low',
        weight: 10,
      });
    }
  }

  if (data.tokenTransfers.length > 0) {
    let largeTokenTransfers = 0;
    for (const t of data.tokenTransfers) {
      const decimals = Number(t.tokenDecimal) || 18;
      const tokenValue = Number(t.value) / Math.pow(10, decimals);
      if (tokenValue > 10000) {
        largeTokenTransfers++;
      }
    }
    if (largeTokenTransfers > 0) {
      score += Math.min(largeTokenTransfers * 10, 20);
      riskFactors.push({
        title: 'Large Token Transfers',
        description: `${largeTokenTransfers} token transfer(s) in this transaction involve large quantities (10,000+ units). High-value token movements may indicate significant fund relocation.`,
        severity: 'medium',
        weight: Math.min(largeTokenTransfers * 10, 20),
      });
    }
  }

  if (data.tokenTransfers.length > 10) {
    score += 15;
    riskFactors.push({
      title: 'High Number of Token Transfers',
      description: `${data.tokenTransfers.length} token transfers in a single transaction. A large number of transfers may indicate a batching/distribution pattern, which is sometimes used in phishing or airdrop scams.`,
      severity: 'medium',
      weight: 15,
    });
  }

  if (data.internalTxs.length > 5) {
    score += 15;
    riskFactors.push({
      title: 'Complex Internal Call Structure',
      description: `${data.internalTxs.length} internal transactions detected. High internal call complexity can obscure fund flows and is sometimes used to hide malicious behavior within nested contract calls.`,
      severity: 'medium',
      weight: 15,
    });
  }

  const inputHex = data.input;
  if (inputHex && inputHex !== '0x' && inputHex.length > 1000) {
    score += 10;
    riskFactors.push({
      title: 'Large Input Data',
      description: `The transaction input data is ${Math.round(inputHex.length / 2)} bytes. Unusually large input data may indicate complex contract interactions or embedded payload data.`,
      severity: 'low',
      weight: 10,
    });
  }

  const selfTransfer =
    data.from &&
    data.to &&
    data.from.toLowerCase() === data.to.toLowerCase();
  if (selfTransfer) {
    score += 15;
    riskFactors.push({
      title: 'Self-Transfer',
      description:
        'The sender and receiver are the same address. Self-transfers can be used to artificially inflate transaction counts or trigger contract logic in unexpected ways.',
      severity: 'medium',
      weight: 15,
    });
  }

  if (data.tokenTransfers.length > 0) {
    const allSameDirection = data.tokenTransfers.every(
      (t) =>
        t.from.toLowerCase() === data.from.toLowerCase() &&
        t.to.toLowerCase() !== data.from.toLowerCase()
    );
    if (allSameDirection && data.tokenTransfers.length > 3) {
      score += 15;
      riskFactors.push({
        title: 'One-Way Token Distribution',
        description: `${data.tokenTransfers.length} token transfers all flow outward from the sender to different recipients. This distribution pattern can be associated with phishing payouts or token dispersal schemes.`,
        severity: 'medium',
        weight: 15,
      });
    }
  }

  const gasUsed = Number(data.gasUsed);
  if (gasUsed > 500000) {
    score += 10;
    riskFactors.push({
      title: 'High Gas Consumption',
      description: `This transaction consumed ${gasUsed.toLocaleString()} gas units. High gas usage indicates computationally intensive operations, which can sometimes signal complex or unexpected contract behavior.`,
      severity: 'low',
      weight: 10,
    });
  }

  if (riskFactors.length === 0) {
    riskFactors.push({
      title: 'No Significant Risk Patterns',
      description:
        'This transaction shows normal on-chain behavior with no suspicious indicators detected. This does not guarantee the transaction is safe — it means no known risk patterns were identified in the available data.',
      severity: 'low',
      weight: 0,
    });
  }

  score = Math.min(score, 100);

  const level: RiskLevel =
    score < 40 ? 'safe' : score < 70 ? 'caution' : 'danger';

  const summaries: Record<RiskLevel, string> = {
    safe:
      'Low risk profile. No critical red flags detected in the available transaction data. This assessment is based solely on on-chain data and does not constitute a guarantee of safety.',
    caution:
      'Moderate risk indicators identified. Several factors warrant attention. This assessment reflects on-chain patterns only and does not confirm fraudulent intent.',
    danger:
      'Multiple high-risk indicators detected. This transaction exhibits patterns commonly associated with suspicious activity, though this does not conclusively prove fraud.',
  };

  return {
    score,
    level,
    riskFactors,
    suspiciousAddresses,
    summary: summaries[level],
  };
}
