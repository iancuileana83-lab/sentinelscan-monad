// Browser wallet access (MetaMask or any EIP-1193 wallet). Nothing is requested until
// the user clicks a button, and nothing is ever sent without the wallet's own approval.
import { BrowserProvider, Contract } from 'ethers';
import { MONAD_TESTNET, REGISTRY_ABI, REGISTRY_ADDRESS } from './registryConfig';

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
  if (!window.ethereum) throw new Error('No wallet found. Install MetaMask to record a signal.');
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

export function friendlyWalletError(e: unknown): string {
  const err = e as { code?: number | string; shortMessage?: string; message?: string; reason?: string };
  if (err.code === 4001 || err.code === 'ACTION_REJECTED') return 'You cancelled the request in your wallet. Nothing was sent.';
  if (err.reason === 'InvalidSubject' || /InvalidSubject/.test(err.message ?? ''))
    return 'You cannot record a signal about your own wallet.';
  if (/insufficient funds/i.test(err.message ?? '')) return 'Not enough testnet MON. Get some from the faucet: faucet.monad.xyz.';
  return err.shortMessage || err.message || 'The wallet request failed.';
}
