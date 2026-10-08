import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CONTRACTS, GUARDED_PAY_ABI, RISK_REGISTRY_ABI, SentinelScan, SentinelScanError } from '../src/index.ts';

const ADDR = '0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e';
const HASH = '0x' + 'ab'.repeat(32);

type Call = { url: string; body: { tool: string; arguments: Record<string, unknown> } };

/** A fake server that answers each tool with a small, realistic payload. */
function fakeFetch(calls: Call[], override?: (tool: string) => Response | undefined): typeof fetch {
  return (async (url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    calls.push({ url: String(url), body });
    const o = override?.(body.tool);
    if (o) return o;
    const results: Record<string, unknown> = {
      scan_wallet: { network: 'monad-testnet', chainId: 10143, address: ADDR, riskSignal: { score: 65, level: 'caution', reasonCode: 3, reasonLabel: 'Single counterparty' }, signals: [{ title: 'One-Way Outflow Pattern', severity: 'high', description: 'x' }], facts: {}, evidence: { recentTransactions: [], topCounterparties: [] }, summary: 's', recommendation: 'r', notice: 'signal, not verdict' },
      get_registry_signals: { network: 'monad-testnet', subject: ADDR, registry: CONTRACTS.riskRegistry, reporterCount: 2, averageScore: 85, lastReportedAt: null, reporterSignal: null, notice: 'n' },
      guard_quote: { network: 'monad-testnet', guard: CONTRACTS.guardedPay, recipient: ADDR, decision: 'confirm', averageScore: 65, reporters: 1, explanation: 'e', notice: 'n' },
      scan_transaction: { network: 'monad-testnet', chainId: 10143, hash: HASH, riskSignal: { score: 10, level: 'safe' }, signals: [], facts: {}, summary: 's', notice: 'n' },
    };
    return new Response(JSON.stringify({ ok: true, result: results[body.tool] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
}

test('check() makes the three reads in parallel and combines them', async () => {
  const calls: Call[] = [];
  const sentinel = new SentinelScan({ fetch: fakeFetch(calls), baseUrl: 'https://example.test/' });
  const r = await sentinel.check(ADDR);
  assert.deepEqual(calls.map((c) => c.body.tool).sort(), ['get_registry_signals', 'guard_quote', 'scan_wallet']);
  assert.ok(calls.every((c) => c.url === 'https://example.test/api/agent-tools'));
  assert.ok(calls.every((c) => c.body.arguments.address === ADDR));
  assert.equal(r.score, 65);
  assert.equal(r.level, 'caution');
  assert.equal(r.registry.reporterCount, 2);
  assert.equal(r.guard.decision, 'confirm');
  assert.equal(r.suggestion, 'ask-a-human');
});

test('the suggestion follows the guard: allow proceeds, block stops', async () => {
  for (const [decision, expected] of [['allow', 'proceed'], ['block', 'stop']] as const) {
    const fetcher = fakeFetch([], (tool) =>
      tool === 'guard_quote' ? new Response(JSON.stringify({ ok: true, result: { decision, averageScore: 1, reporters: 0, explanation: '', network: '', guard: '', recipient: '', notice: '' } }), { status: 200 }) : undefined
    );
    assert.equal((await new SentinelScan({ fetch: fetcher }).check(ADDR)).suggestion, expected);
  }
});

test('scanTransaction and registrySignals send the right arguments', async () => {
  const calls: Call[] = [];
  const sentinel = new SentinelScan({ fetch: fakeFetch(calls) });
  await sentinel.scanTransaction(HASH);
  await sentinel.registrySignals(ADDR, { reporter: CONTRACTS.guardedPay });
  assert.deepEqual(calls[0].body, { tool: 'scan_transaction', arguments: { hash: HASH } });
  assert.deepEqual(calls[1].body, { tool: 'get_registry_signals', arguments: { address: ADDR, reporter: CONTRACTS.guardedPay } });
});

test('bad input is rejected before any network call', async () => {
  const calls: Call[] = [];
  const sentinel = new SentinelScan({ fetch: fakeFetch(calls) });
  await assert.rejects(() => sentinel.scanWallet('nope'), SentinelScanError);
  await assert.rejects(() => sentinel.guardQuote('0x123'), SentinelScanError);
  await assert.rejects(() => sentinel.scanTransaction('0x' + 'a'.repeat(40)), SentinelScanError);
  await assert.rejects(() => sentinel.registrySignals(ADDR, { reporter: 'x' }), SentinelScanError);
  assert.equal(calls.length, 0);
});

test('server errors become SentinelScanError with the status and the message', async () => {
  const limited = fakeFetch([], () => new Response(JSON.stringify({ ok: false, error: 'Rate limit: please slow down.' }), { status: 429 }));
  await assert.rejects(
    () => new SentinelScan({ fetch: limited }).guardQuote(ADDR),
    (e: unknown) => e instanceof SentinelScanError && e.status === 429 && /Rate limit/.test(e.message)
  );
  const down = (async () => {
    throw new TypeError('network down');
  }) as unknown as typeof fetch;
  await assert.rejects(() => new SentinelScan({ fetch: down }).guardQuote(ADDR), /Could not reach SentinelScan/);
});

test('exported addresses match the recorded deployments and the ABIs expose the guard and registry reads', () => {
  const d = JSON.parse(fs.readFileSync(new URL('../../../deployments/monad-testnet.json', import.meta.url), 'utf8'));
  assert.equal(CONTRACTS.riskRegistry, d.address);
  assert.equal(CONTRACTS.guardedPay, d.guardedPay.address);
  assert.ok(RISK_REGISTRY_ABI.some((l) => l.startsWith('function getSummary')));
  assert.ok(GUARDED_PAY_ABI.some((l) => l.startsWith('function quote')));
});
