// Browser wallet access (any EIP-1193 wallet). This module is loaded only when the visitor
// clicks a wallet button, so the page itself makes no wallet requests. Nothing is ever
// sent without the wallet's own approval.
import { BrowserProvider, Contract, Interface, parseEther } from 'ethers';
import { GUARD_ADDRESS, MONAD_TESTNET, REGISTRY_ADDRESS } from './registryConfig';
import { GUARD_ABI, REGISTRY_ABI } from './registryAbi';

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

export const hasWallet = () => typeof window !== 'undefined' && !!window.ethereum;

function provider(): Eip1193 {
  if (!window.ethereum) throw new Error('No browser wallet found. Scanning works without one; recording a signal needs a wallet.');
  return window.ethereum;
}

export async function connectWallet(): Promise<string> {
  const accounts = (await provider().request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts[0]) throw new Error('The wallet did not share an account.');
  return accounts[0];
}

export async function currentChainId(): Promise<number> {
  return parseInt((await provider().request({ method: 'eth_chainId' })) as string, 16);
}

/** Switch to Monad Testnet, adding it to the wallet first if it is unknown. */
export async function ensureMonadTestnet(): Promise<void> {
  const eth = provider();
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: MONAD_TESTNET.chainIdHex }] });
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e;
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: MONAD_TESTNET.chainIdHex,
          chainName: MONAD_TESTNET.name,
          rpcUrls: [MONAD_TESTNET.rpcUrl],
          nativeCurrency: MONAD_TESTNET.currency,
          blockExplorerUrls: [MONAD_TESTNET.explorer],
        },
      ],
    });
  }
}

async function registry() {
  const signer = await new BrowserProvider(provider()).getSigner();
  return new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
}

/** Sends the transaction and returns its hash as soon as the wallet has signed it. */
export async function sendReport(subject: string, score: number, reasonCode: number) {
  await ensureMonadTestnet();
  const tx = await (await registry()).report(subject, score, reasonCode);
  return { hash: tx.hash as string, confirmed: tx.wait() as Promise<unknown> };
}

export async function sendRetract(subject: string) {
  await ensureMonadTestnet();
  const tx = await (await registry()).retract(subject);
  return { hash: tx.hash as string, confirmed: tx.wait() as Promise<unknown> };
}

/** Pays test MON through GuardedPay. The contract itself refuses blocked recipients. */
export async function sendGuardedPay(recipient: string, amountMon: string, acknowledgeRisk: boolean) {
  await ensureMonadTestnet();
  const signer = await new BrowserProvider(provider()).getSigner();
  const guard = new Contract(GUARD_ADDRESS, GUARD_ABI, signer);
  // A friendly pre-check. The contract enforces the same rule on-chain, whatever this page says.
  const [decision, averageScore, reporters] = await guard.quote(recipient);
  if (Number(decision) === 2) throw Object.assign(new Error('guard blocked'), { guard: 'Blocked', averageScore, reporters });
  if (Number(decision) === 1 && !acknowledgeRisk) throw Object.assign(new Error('guard needs confirmation'), { guard: 'ConfirmationRequired', averageScore, reporters });
  const tx = await guard.pay(recipient, acknowledgeRisk, { value: parseEther(amountMon) });
  return { hash: tx.hash as string, confirmed: tx.wait() as Promise<unknown> };
}

/** Follow account switches made inside the wallet. Returns an unsubscribe function. */
export function watchAccounts(onChange: (account: string) => void): () => void {
  const eth = window.ethereum;
  if (!eth?.on) return () => {};
  const handler = (accounts: unknown) => onChange(Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : '');
  eth.on('accountsChanged', handler);
  return () => eth.removeListener?.('accountsChanged', handler);
}

export function friendlyWalletError(e: unknown): string {
  const err = e as { code?: number | string; shortMessage?: string; message?: string; reason?: string };
  if (err.code === 4001 || err.code === 'ACTION_REJECTED') return 'You cancelled the request in your wallet. Nothing was sent.';
  let name = (e as { revert?: { name?: string } }).revert?.name ?? (e as { guard?: string }).guard ?? '';
  const raw = (e as { data?: unknown; error?: { data?: unknown } }).data ?? (e as { error?: { data?: unknown } }).error?.data;
  if (!name && typeof raw === 'string' && raw.startsWith('0x')) {
    try {
      name = new Interface(GUARD_ABI).parseError(raw)?.name ?? '';
    } catch {
      name = '';
    }
  }
  if (name === 'Blocked' || /Blocked/.test(err.message ?? '')) return 'The on-chain guard blocked this payment: several reporters recorded a high score for this address. Nothing was sent.';
  if (name === 'ConfirmationRequired' || /ConfirmationRequired/.test(err.message ?? '')) return 'The guard needs you to confirm the risk first. Tick the box and try again.';
  if (err.reason === 'InvalidSubject' || /InvalidSubject/.test(err.message ?? ''))
    return 'You cannot record a signal about your own wallet.';
  if (/insufficient funds/i.test(err.message ?? '')) return 'Not enough testnet MON. Get some from the faucet: faucet.monad.xyz.';
  return err.shortMessage || err.message || 'The wallet request failed.';
}
