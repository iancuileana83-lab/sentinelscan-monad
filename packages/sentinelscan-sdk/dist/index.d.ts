/**
 * sentinelscan-sdk: check an address on Monad Testnet in three lines.
 *
 *   import { SentinelScan } from 'sentinelscan-sdk';
 *   const sentinel = new SentinelScan();
 *   const check = await sentinel.check('0x...');
 *
 * No dependencies. It talks to the public SentinelScan on Monad API (read-only: it never signs or sends anything)
 * and also exports the contract addresses and ABIs, so your own contracts and scripts can use RiskRegistry and
 * GuardedPay directly. A score is a signal about patterns in public data, never a verdict.
 */
export declare const DEFAULT_BASE_URL = "https://sentinelscan-monad.vercel.app";
export declare const MONAD_TESTNET: {
    readonly chainId: 10143;
    readonly rpcUrl: "https://rpc-testnet.monadinfra.com";
    readonly explorer: "https://testnet.monadscan.com";
};
/** Verified on the Monad Testnet explorer. */
export declare const CONTRACTS: {
    readonly riskRegistry: "0xb0C3Be753788a5962DE52db929f49df02700AFd4";
    readonly guardedPay: "0x6e124EB8B980ae3e1CB79f856b8dC0d6F691d5bD";
};
/** Human-readable ABIs, ready for ethers (`new Contract(address, abi, signerOrProvider)`) or viem's `parseAbi`. */
export declare const RISK_REGISTRY_ABI: readonly ["function report(address subject, uint8 score, uint8 reasonCode)", "function retract(address subject)", "function getSummary(address subject) view returns (uint32 reporterCount, uint8 averageScore, uint64 lastReportedAt)", "function getSignal(address subject, address reporter) view returns (uint8 score, uint8 reasonCode, uint64 reportedAt)", "event SignalRecorded(address indexed subject, address indexed reporter, uint8 score, uint8 reasonCode, uint32 reporterCount)", "event SignalRetracted(address indexed subject, address indexed reporter, uint32 reporterCount)"];
export declare const GUARDED_PAY_ABI: readonly ["function pay(address recipient, bool acknowledgeRisk) payable", "function quote(address recipient) view returns (uint8 decision, uint8 averageScore, uint32 reporters)", "error Blocked(uint8 averageScore, uint32 reporters)", "error ConfirmationRequired(uint8 averageScore, uint32 reporters)", "error InvalidRecipient()", "error NoValue()", "error TransferFailed()"];
/** Reason codes stored next to each score in RiskRegistry. */
export declare const REASON_LABELS: readonly ["Other", "Very new wallet", "High-frequency counterparty", "Single counterparty", "One-way outflow", "Null-address interaction", "Failed or unusual transaction", "Contract deployment", "Large transfer"];
export type RiskLevel = 'safe' | 'caution' | 'danger';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type GuardDecision = 'allow' | 'confirm' | 'block';
export interface Signal {
    title: string;
    severity: Severity;
    description: string;
}
export interface WalletReport {
    network: string;
    chainId: number;
    address: string;
    riskSignal: {
        score: number;
        level: RiskLevel;
        reasonCode: number;
        reasonLabel: string;
    };
    signals: Signal[];
    facts: Record<string, string | number | undefined>;
    evidence: {
        recentTransactions: {
            hash: string;
            from: string;
            to: string;
            valueMON: string;
            time?: string;
        }[];
        topCounterparties: {
            address: string;
            interactions: number;
        }[];
    };
    summary: string;
    recommendation: string;
    notice: string;
}
export interface TransactionReport {
    network: string;
    chainId: number;
    hash: string;
    riskSignal: {
        score: number;
        level: RiskLevel;
    };
    signals: Signal[];
    facts: Record<string, string | number | boolean | null | undefined>;
    summary: string;
    notice: string;
}
export interface RegistrySignals {
    network: string;
    subject: string;
    registry: string;
    reporterCount: number;
    /** Plain on-chain average over distinct reporters; null when nobody has reported. */
    averageScore: number | null;
    lastReportedAt: string | null;
    /** Average weighted by each reporter wallet's age, activity and restraint (off-chain heuristic). */
    reputationWeighted?: {
        weightedAverage: number | null;
        plainAverage: number | null;
        effectiveReporters: number;
        reporters: {
            reporter: string;
            score: number;
            reasonLabel: string;
            weight: number;
        }[];
    };
    reporterSignal: {
        score: number;
        reasonCode: number;
        reasonLabel: string;
    } | null;
    notice: string;
}
export interface GuardQuote {
    network: string;
    guard: string;
    recipient: string;
    decision: GuardDecision;
    averageScore: number;
    reporters: number;
    explanation: string;
    notice: string;
}
export interface AddressCheck {
    address: string;
    /** The 0-100 risk signal from the scanner. */
    score: number;
    level: RiskLevel;
    signals: Signal[];
    registry: RegistrySignals;
    guard: GuardQuote;
    /** A hint derived from the on-chain guard, never a verdict: proceed, ask a human, or stop. */
    suggestion: 'proceed' | 'ask-a-human' | 'stop';
    notice: string;
}
export declare class SentinelScanError extends Error {
    readonly status?: number;
    constructor(message: string, status?: number);
}
export interface SentinelScanOptions {
    /** Defaults to the public deployment. Point it at your own copy of the app if you host one. */
    baseUrl?: string;
    /** Inject a fetch (tests, older runtimes). Defaults to the global fetch. */
    fetch?: typeof fetch;
    /** Per-request timeout in milliseconds. Default 30000. */
    timeoutMs?: number;
}
export declare class SentinelScan {
    private readonly baseUrl;
    private readonly doFetch;
    private readonly timeoutMs;
    constructor(options?: SentinelScanOptions);
    private call;
    private address;
    /** Risk signal, signals with explanations, facts and evidence for a wallet (latest 100 transactions). */
    scanWallet(address: string): Promise<WalletReport>;
    scanTransaction(hash: string): Promise<TransactionReport>;
    /** What the public RiskRegistry says about an address: reporters, average, reputation-weighted average. */
    registrySignals(address: string, options?: {
        reporter?: string;
    }): Promise<RegistrySignals>;
    /** What the on-chain GuardedPay contract would do for a payment to this address: allow, confirm or block. */
    guardQuote(address: string): Promise<GuardQuote>;
    /** The three reads together, in parallel. */
    check(address: string): Promise<AddressCheck>;
}
