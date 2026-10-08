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
export const DEFAULT_BASE_URL = 'https://sentinelscan-monad.vercel.app';
export const MONAD_TESTNET = { chainId: 10143, rpcUrl: 'https://rpc-testnet.monadinfra.com', explorer: 'https://testnet.monadscan.com' };
/** Verified on the Monad Testnet explorer. */
export const CONTRACTS = {
    riskRegistry: '0xb0C3Be753788a5962DE52db929f49df02700AFd4',
    guardedPay: '0x6e124EB8B980ae3e1CB79f856b8dC0d6F691d5bD',
};
/** Human-readable ABIs, ready for ethers (`new Contract(address, abi, signerOrProvider)`) or viem's `parseAbi`. */
export const RISK_REGISTRY_ABI = [
    'function report(address subject, uint8 score, uint8 reasonCode)',
    'function retract(address subject)',
    'function getSummary(address subject) view returns (uint32 reporterCount, uint8 averageScore, uint64 lastReportedAt)',
    'function getSignal(address subject, address reporter) view returns (uint8 score, uint8 reasonCode, uint64 reportedAt)',
    'event SignalRecorded(address indexed subject, address indexed reporter, uint8 score, uint8 reasonCode, uint32 reporterCount)',
    'event SignalRetracted(address indexed subject, address indexed reporter, uint32 reporterCount)',
];
export const GUARDED_PAY_ABI = [
    'function pay(address recipient, bool acknowledgeRisk) payable',
    'function quote(address recipient) view returns (uint8 decision, uint8 averageScore, uint32 reporters)',
    'error Blocked(uint8 averageScore, uint32 reporters)',
    'error ConfirmationRequired(uint8 averageScore, uint32 reporters)',
    'error InvalidRecipient()',
    'error NoValue()',
    'error TransferFailed()',
];
/** Reason codes stored next to each score in RiskRegistry. */
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
];
export class SentinelScanError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = 'SentinelScanError';
        this.status = status;
    }
}
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
export class SentinelScan {
    baseUrl;
    doFetch;
    timeoutMs;
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.doFetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
        this.timeoutMs = options.timeoutMs ?? 30_000;
    }
    async call(tool, args) {
        let res;
        try {
            res = await this.doFetch(`${this.baseUrl}/api/agent-tools`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ tool, arguments: args }),
                signal: AbortSignal.timeout(this.timeoutMs),
            });
        }
        catch (e) {
            throw new SentinelScanError(e instanceof Error && e.name === 'TimeoutError' ? 'SentinelScan took too long to answer.' : 'Could not reach SentinelScan.');
        }
        const body = (await res.json().catch(() => ({})));
        if (!res.ok || body.ok === false || body.result === undefined) {
            throw new SentinelScanError(body.error ?? `SentinelScan returned ${res.status}.`, res.status);
        }
        return body.result;
    }
    address(value) {
        if (!ADDRESS.test(value))
            throw new SentinelScanError('Expected an address: 0x followed by 40 hex characters.');
        return value;
    }
    /** Risk signal, signals with explanations, facts and evidence for a wallet (latest 100 transactions). */
    async scanWallet(address) {
        return this.call('scan_wallet', { address: this.address(address) });
    }
    async scanTransaction(hash) {
        if (!TX_HASH.test(hash))
            throw new SentinelScanError('Expected a transaction hash: 0x followed by 64 hex characters.');
        return this.call('scan_transaction', { hash });
    }
    /** What the public RiskRegistry says about an address: reporters, average, reputation-weighted average. */
    async registrySignals(address, options = {}) {
        const args = { address: this.address(address) };
        if (options.reporter)
            args.reporter = this.address(options.reporter);
        return this.call('get_registry_signals', args);
    }
    /** What the on-chain GuardedPay contract would do for a payment to this address: allow, confirm or block. */
    async guardQuote(address) {
        return this.call('guard_quote', { address: this.address(address) });
    }
    /** The three reads together, in parallel. */
    async check(address) {
        const [wallet, registry, guard] = await Promise.all([this.scanWallet(address), this.registrySignals(address), this.guardQuote(address)]);
        return {
            address,
            score: wallet.riskSignal.score,
            level: wallet.riskSignal.level,
            signals: wallet.signals,
            registry,
            guard,
            suggestion: guard.decision === 'block' ? 'stop' : guard.decision === 'confirm' ? 'ask-a-human' : 'proceed',
            notice: wallet.notice,
        };
    }
}
