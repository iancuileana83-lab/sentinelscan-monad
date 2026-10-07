import type { RiskLevel } from '../types.ts';
import type { WalletData, WalletRiskAssessment } from './walletRisk.ts';
import type { TxData, TxRiskAssessment } from './txRisk.ts';

export interface RiskExplanation {
  summary: string;
  detectedEvidence: { label: string; detail: string }[];
  interpretation: string[];
  recommendation: string;
}

function levelWord(level: RiskLevel): string {
  if (level === 'safe') return 'a low-risk';
  if (level === 'caution') return 'an elevated-risk';
  return 'a high-risk';
}

function severityCount(factors: { severity: string }[]): {
  critical: number;
  high: number;
  medium: number;
  low: number;
} {
  return {
    critical: factors.filter((f) => f.severity === 'critical').length,
    high: factors.filter((f) => f.severity === 'high').length,
    medium: factors.filter((f) => f.severity === 'medium').length,
    low: factors.filter((f) => f.severity === 'low').length,
  };
}

export function explainWalletRisk(
  data: WalletData,
  assessment: WalletRiskAssessment
): RiskExplanation {
  const detectedEvidence: { label: string; detail: string }[] = [];
  const interpretation: string[] = [];

  detectedEvidence.push({
    label: 'Transaction Count',
    detail: `${data.txCount} transactions found on-chain`,
  });

  if (data.firstSeen) {
    const days = Math.round(
      (Date.now() - new Date(data.firstSeen).getTime()) / 86400000
    );
    detectedEvidence.push({
      label: 'Wallet Age',
      detail: `First on-chain activity ${days} days ago (${new Date(data.firstSeen).toLocaleDateString()})`,
    });
  }

  if (data.tokenCount > 0) {
    detectedEvidence.push({
      label: 'Token Holdings',
      detail: `${data.tokenCount} distinct tokens held`,
    });
  }

  if (data.contractInteractions.length > 0) {
    detectedEvidence.push({
      label: 'Counterparties',
      detail: `${data.contractInteractions.length} unique addresses interacted with`,
    });
  }

  for (const f of assessment.riskFactors) {
    if (f.severity === 'low' && f.title === 'No Significant Risk Patterns')
      continue;
    detectedEvidence.push({
      label: f.title,
      detail: f.description,
    });
  }

  if (assessment.suspiciousInteractions.length > 0) {
    detectedEvidence.push({
      label: 'Suspicious Interactions',
      detail: assessment.suspiciousInteractions
        .map((s) => `${s.address.slice(0, 10)}... (${s.reason})`)
        .join('; '),
    });
  }

  if (assessment.suspiciousContracts.length > 0) {
    detectedEvidence.push({
      label: 'Suspicious Contracts',
      detail: assessment.suspiciousContracts
        .map((s) => `${s.address.slice(0, 10)}... (${s.reason})`)
        .join('; '),
    });
  }

  const sc = severityCount(assessment.riskFactors);

  if (assessment.level === 'safe') {
    interpretation.push(
      `Based on the on-chain data, this wallet exhibits ${levelWord(assessment.level)} activity profile. The transaction history shows normal patterns with no significant red flags detected in the retrieved data.`
    );
    interpretation.push(
      `The wallet's activity level (${data.txCount} transactions), counterparty diversity (${data.contractInteractions.length} addresses), and token holdings do not match known suspicious patterns. However, the absence of detected risk factors does not guarantee the wallet is safe — it only means no known indicators were present in the available data.`
    );
  } else {
    interpretation.push(
      `Based on the on-chain data, this wallet exhibits ${levelWord(assessment.level)} profile with a risk score of ${assessment.score}/100. The score is driven by ${assessment.riskFactors.length} detected factor(s): ${sc.high} high-severity, ${sc.medium} medium-severity, and ${sc.low} low-severity.`
    );

    if (sc.high > 0 || sc.critical > 0) {
      const highFactors = assessment.riskFactors.filter(
        (f) => f.severity === 'high' || f.severity === 'critical'
      );
      interpretation.push(
        `The most significant concerns are: ${highFactors.map((f) => f.title).join(', ')}. These patterns are commonly associated with suspicious wallet behavior, though they do not conclusively prove fraudulent intent.`
      );
    }

    if (data.txCount > 0 && data.txCount <= 5) {
      interpretation.push(
        `The very low transaction count (${data.txCount}) suggests this is either a new or rarely-used wallet. New wallets carry higher uncertainty because there is less historical data to establish a reputation. This alone does not indicate wrongdoing.`
      );
    }

    if (
      data.contractInteractions.length === 1 &&
      data.txCount > 10
    ) {
      interpretation.push(
        `All ${data.txCount} transactions involve a single counterparty address. While this could be a legitimate relationship (e.g., a known exchange or service), this pattern is also seen in funnel schemes where funds are routed through a single controlled address.`
      );
    }
  }

  let recommendation: string;
  if (assessment.level === 'safe') {
    recommendation =
      'No immediate action is required based on the available data. Continue monitoring if you plan to engage with this wallet, and consider additional due diligence for high-value interactions.';
  } else if (assessment.level === 'caution') {
    recommendation =
      'Exercise caution before engaging with this wallet. Review the specific risk factors above, verify the counterparty addresses independently, and consider starting with a small test transaction if you must interact.';
  } else {
    recommendation =
      'Strongly consider avoiding interaction with this wallet until the identified risk factors are understood and mitigated. If you must engage, use a dedicated wallet with limited funds and verify all counterparty addresses through additional sources.';
  }

  const summary = `This wallet address on ${data.network} shows ${levelWord(assessment.level)} profile with a score of ${assessment.score}/100. ${assessment.riskFactors.length} risk factor(s) were identified from the retrieved on-chain data. The assessment below separates what was directly detected on-chain from how those findings are interpreted.`;

  return { summary, detectedEvidence, interpretation, recommendation };
}

export function explainTxRisk(
  data: TxData,
  assessment: TxRiskAssessment
): RiskExplanation {
  const detectedEvidence: { label: string; detail: string }[] = [];
  const interpretation: string[] = [];

  detectedEvidence.push({
    label: 'Transaction Hash',
    detail: `${data.hash.slice(0, 18)}...`,
  });

  detectedEvidence.push({
    label: 'Network',
    detail: data.network,
  });

  detectedEvidence.push({
    label: 'Status',
    detail: data.isSuccess ? 'Succeeded on-chain' : 'Failed / reverted on-chain',
  });

  detectedEvidence.push({
    label: 'Block',
    detail: `Block #${data.blockNumber.toLocaleString()} at ${data.timeStamp ? new Date(Number(data.timeStamp) * 1000).toLocaleString() : 'unknown time'}`,
  });

  if (data.value && Number(data.value) > 0) {
    const ethVal = Number(data.value) / 1e18;
    detectedEvidence.push({
      label: 'Native Value',
      detail: `${ethVal.toLocaleString(undefined, { maximumFractionDigits: 4 })} MON`,
    });
  }

  detectedEvidence.push({
    label: 'Gas Used',
    detail: `${Number(data.gasUsed).toLocaleString()} gas units`,
  });

  if (data.tokenTransfers.length > 0) {
    detectedEvidence.push({
      label: 'Token Transfers',
      detail: `${data.tokenTransfers.length} token transfer(s): ${data.tokenTransfers.slice(0, 3).map((t) => `${t.tokenSymbol}`).join(', ')}${data.tokenTransfers.length > 3 ? '...' : ''}`,
    });
  }

  if (data.internalTxs.length > 0) {
    detectedEvidence.push({
      label: 'Internal Calls',
      detail: `${data.internalTxs.length} internal transaction(s) detected`,
    });
  }

  if (data.functionName) {
    detectedEvidence.push({
      label: 'Function Called',
      detail: data.functionName,
    });
  }

  for (const f of assessment.riskFactors) {
    if (f.severity === 'low' && f.title === 'No Significant Risk Patterns')
      continue;
    detectedEvidence.push({
      label: f.title,
      detail: f.description,
    });
  }

  if (assessment.suspiciousAddresses.length > 0) {
    detectedEvidence.push({
      label: 'Suspicious Addresses',
      detail: assessment.suspiciousAddresses
        .map((s) => `${s.address.slice(0, 10)}... (${s.reason})`)
        .join('; '),
    });
  }

  const sc = severityCount(assessment.riskFactors);

  if (assessment.level === 'safe') {
    interpretation.push(
      `Based on the retrieved on-chain data, this transaction exhibits ${levelWord(assessment.level)} profile. The transaction ${data.isSuccess ? 'succeeded' : 'failed'}, and no significant suspicious patterns were detected in the available data.`
    );
    interpretation.push(
      `The transaction's value, gas usage, token transfers, and internal call structure do not match known risk patterns. This does not guarantee the transaction is safe — it means no known indicators were present in the data retrieved from the blockchain explorer.`
    );
  } else {
    interpretation.push(
      `Based on the retrieved on-chain data, this transaction exhibits ${levelRiskWord(assessment.level)} profile with a risk score of ${assessment.score}/100. The score is driven by ${assessment.riskFactors.length} detected factor(s): ${sc.high} high-severity, ${sc.medium} medium-severity, and ${sc.low} low-severity.`
    );

    if (!data.isSuccess) {
      interpretation.push(
        `The transaction failed on-chain, which is a detected fact. Failed transactions can result from innocent causes (insufficient gas, contract logic errors) but can also indicate a failed exploit attempt or a front-run. The failure itself is evidence; the cause is interpretation.`
      );
    }

    if (sc.high > 0 || sc.critical > 0) {
      const highFactors = assessment.riskFactors.filter(
        (f) => f.severity === 'high' || f.severity === 'critical'
      );
      interpretation.push(
        `The most significant detected patterns are: ${highFactors.map((f) => f.title).join(', ')}. These are commonly associated with suspicious transaction behavior, but they do not conclusively prove fraud. Each factor is listed above with its specific point contribution to the score.`
      );
    }

    if (data.tokenTransfers.length > 10) {
      interpretation.push(
        `The high number of token transfers (${data.tokenTransfers.length}) in a single transaction is a detected on-chain fact. This pattern can be legitimate (e.g., a batch distribution or airdrop) but is also used in phishing payouts. The interpretation depends on context that the on-chain data alone cannot fully establish.`
      );
    }

    if (data.internalTxs.length > 5) {
      interpretation.push(
        `The ${data.internalTxs.length} internal calls create a complex execution trace. This is a detected fact. Complex internal call structures can obscure fund flows and are sometimes used to hide malicious behavior, but they also occur in legitimate DeFi composability.`
      );
    }
  }

  let recommendation: string;
  if (assessment.level === 'safe') {
    recommendation =
      'No immediate concerns based on the available data. If this transaction involves significant value, consider additional verification through other analysis tools or manual review of the contract source code.';
  } else if (assessment.level === 'caution') {
    recommendation =
      'Review the specific risk factors above before drawing conclusions. Verify the addresses involved through additional sources, and if this transaction is related to a project you are considering, check the project documentation against the observed contract behavior.';
  } else {
    recommendation =
      'Multiple high-risk indicators were detected. Treat this transaction with caution and avoid replicating or interacting with the addresses involved until you understand the context. If you received this transaction unexpectedly, do not interact with any contracts it references and verify through independent sources.';
  }

  const summary = `This transaction on ${data.network} shows ${levelRiskWord(assessment.level)} profile with a score of ${assessment.score}/100. ${assessment.riskFactors.length} risk factor(s) were identified from the retrieved on-chain data. The explanation below clearly separates detected on-chain evidence from rule-based interpretation.`;

  return { summary, detectedEvidence, interpretation, recommendation };
}

function levelRiskWord(level: RiskLevel): string {
  if (level === 'safe') return 'a low-risk';
  if (level === 'caution') return 'an elevated-risk';
  return 'a high-risk';
}
