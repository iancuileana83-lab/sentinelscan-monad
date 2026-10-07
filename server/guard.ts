// Read-only view of what GuardedPay would do for a recipient.
import { Interface } from 'ethers';
import { GUARD_ADDRESS, GUARD_POLICY } from '../src/lib/registryConfig.ts';
import { GUARD_ABI } from '../src/lib/registryAbi.ts';
import { rpc } from './monad.ts';

const iface = new Interface(GUARD_ABI);
const NAMES = ['allow', 'confirm', 'block'] as const;

export interface GuardQuote {
  guard: string;
  recipient: string;
  decision: (typeof NAMES)[number];
  averageScore: number;
  reporters: number;
  policy: typeof GUARD_POLICY;
  explanation: string;
}

export function explainDecision(decision: GuardQuote['decision'], averageScore: number, reporters: number): string {
  const p = GUARD_POLICY;
  if (decision === 'block') {
    return `Blocked: ${reporters} reporters recorded an average score of ${averageScore}, at or above ${p.blockScore} with at least ${p.minReportersToBlock} reporters. The payment would be refused even if the payer confirms.`;
  }
  if (decision === 'confirm') {
    return `Confirmation needed: ${reporters} reporter(s) recorded an average score of ${averageScore}, at or above ${p.confirmScore}. The payment goes through only if the payer explicitly acknowledges the risk. One reporter alone can never block a payment.`;
  }
  if (reporters === 0) return 'Allowed: nobody has recorded a signal about this address. That is not a safety guarantee.';
  return `Allowed: ${reporters} reporter(s) recorded an average score of ${averageScore}, below the confirmation threshold of ${p.confirmScore}.`;
}

export async function guardQuote(recipient: string): Promise<GuardQuote> {
  const data = iface.encodeFunctionData('quote', [recipient]);
  const raw = await rpc<string>('eth_call', [{ to: GUARD_ADDRESS, data }, 'latest']);
  const [decision, averageScore, reporters] = iface.decodeFunctionResult('quote', raw);
  const name = NAMES[Number(decision)] ?? 'allow';
  return {
    guard: GUARD_ADDRESS,
    recipient,
    decision: name,
    averageScore: Number(averageScore),
    reporters: Number(reporters),
    policy: GUARD_POLICY,
    explanation: explainDecision(name, Number(averageScore), Number(reporters)),
  };
}
