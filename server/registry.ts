// Read-only view of RiskRegistry, done on the server so the browser needs no RPC access.
import { Interface } from 'ethers';
import { REGISTRY_ABI, REGISTRY_ADDRESS } from '../src/lib/registryConfig.ts';
import { rpc } from './monad.ts';

const iface = new Interface(REGISTRY_ABI);

async function call(fn: string, args: unknown[]) {
  const data = iface.encodeFunctionData(fn, args);
  const raw = await rpc<string>('eth_call', [{ to: REGISTRY_ADDRESS, data }, 'latest']);
  return iface.decodeFunctionResult(fn, raw);
}

export interface RegistryView {
  contract: string;
  reporterCount: number;
  averageScore: number;
  lastReportedAt: number;
  mine?: { score: number; reasonCode: number; reportedAt: number };
}

export async function readRegistry(subject: string, reporter?: string): Promise<RegistryView> {
  const [count, avg, last] = await call('getSummary', [subject]);
  const view: RegistryView = {
    contract: REGISTRY_ADDRESS,
    reporterCount: Number(count),
    averageScore: Number(avg),
    lastReportedAt: Number(last),
  };
  if (reporter) {
    const [score, reasonCode, reportedAt] = await call('getSignal', [subject, reporter]);
    if (Number(reportedAt) > 0) view.mine = { score: Number(score), reasonCode: Number(reasonCode), reportedAt: Number(reportedAt) };
  }
  return view;
}
