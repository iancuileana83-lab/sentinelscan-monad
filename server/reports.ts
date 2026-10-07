// Builds the structured, evidence-carrying reports that agents (and later the AI
// analyst) consume. Everything here is derived from public Monad Testnet data.
import { assessTxRisk } from '../src/lib/txRisk.ts';
import { assessWalletRisk } from '../src/lib/walletRisk.ts';
import { explainTxRisk, explainWalletRisk, type RiskExplanation } from '../src/lib/riskExplainer.ts';
import { REASON_LABELS, pickReasonCode } from '../src/lib/registryConfig.ts';
import { fetchTxData, fetchWalletData, CHAIN_ID, NETWORK } from './monad.ts';
import { cleanText, isoFromUnix, weiToMon } from './safe.ts';

export const NOTICE =
  'A risk score is a signal about patterns in public on-chain data. It is not a verdict, not proof of wrongdoing and not financial advice. Many risky-looking patterns belong to bots, payout accounts and system accounts. Monad Testnet tokens have no real value.';

export interface Signal {
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface WalletReport {
  network: string;
  chainId: number;
  address: string;
  riskSignal: { score: number; level: string; reasonCode: number; reasonLabel: string };
  signals: Signal[];
  facts: Record<string, string | number | undefined>;
  evidence: {
    recentTransactions: { hash: string; from: string; to: string; valueMON: string; time?: string }[];
    topCounterparties: { address: string; interactions: number }[];
    tokens: { contract: string; symbol: string }[];
  };
  summary: string;
  recommendation: string;
  explanation: RiskExplanation;
  notice: string;
}

export async function buildWalletReport(address: string, apiKey: string): Promise<WalletReport> {
  const data = await fetchWalletData(address, apiKey);
  const assessment = assessWalletRisk(data);
  const explanation = explainWalletRisk(data, assessment);
  const reasonCode = pickReasonCode(assessment.riskFactors);
  return {
    network: NETWORK,
    chainId: CHAIN_ID,
    address: data.address,
    riskSignal: { score: assessment.score, level: assessment.level, reasonCode, reasonLabel: REASON_LABELS[reasonCode] },
    signals: assessment.riskFactors.map((f) => ({ title: f.title, severity: f.severity, description: f.description })),
    facts: {
      balanceMON: weiToMon(data.balanceWei),
      transactionsAnalyzed: data.txCount,
      tokensSeen: data.tokenCount,
      firstSeen: data.firstSeen,
      lastActive: data.lastActive,
      note: 'Only the latest 100 transactions are analyzed, not the full history.',
    },
    evidence: {
      recentTransactions: data.transactions.slice(0, 10).map((t) => ({
        hash: t.hash,
        from: t.from,
        to: t.to,
        valueMON: weiToMon(t.value),
        time: isoFromUnix(t.timeStamp),
      })),
      topCounterparties: data.contractInteractions.slice(0, 5).map((c) => ({ address: c.address, interactions: c.count })),
      // Token symbols are chosen by contract deployers: untrusted text, cleaned and shortened.
      tokens: data.tokens.slice(0, 5).map((t) => ({ contract: t.contractAddress, symbol: cleanText(t.symbol, 12) })),
    },
    summary: explanation.summary,
    recommendation: explanation.recommendation,
    explanation,
    notice: NOTICE,
  };
}

export interface TxReport {
  network: string;
  chainId: number;
  hash: string;
  riskSignal: { score: number; level: string };
  signals: Signal[];
  facts: Record<string, string | number | boolean | null | undefined>;
  summary: string;
  recommendation: string;
  explanation: RiskExplanation;
  notice: string;
}

export async function buildTxReport(hash: string, apiKey: string): Promise<TxReport> {
  const data = await fetchTxData(hash, apiKey);
  const assessment = assessTxRisk(data);
  const explanation = explainTxRisk(data, assessment);
  return {
    network: NETWORK,
    chainId: CHAIN_ID,
    hash: data.hash,
    riskSignal: { score: assessment.score, level: assessment.level },
    signals: assessment.riskFactors.map((f) => ({ title: f.title, severity: f.severity, description: f.description })),
    facts: {
      status: data.isSuccess ? 'success' : 'failed',
      from: data.from,
      to: data.to || null,
      valueMON: weiToMon(data.value),
      block: data.blockNumber,
      time: isoFromUnix(data.timeStamp),
      gasUsed: data.gasUsed,
      tokenTransfers: data.tokenTransfers.length,
      internalCalls: data.internalTxs.length,
      functionSelector: data.functionName,
    },
    summary: explanation.summary,
    recommendation: explanation.recommendation,
    explanation,
    notice: NOTICE,
  };
}
