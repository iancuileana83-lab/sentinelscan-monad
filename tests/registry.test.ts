import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REGISTRY_ADDRESS, REASON_LABELS, pickReasonCode } from '../src/lib/registryConfig.ts';

test('app address matches the recorded deployment', () => {
  const d = JSON.parse(fs.readFileSync(new URL('../deployments/monad-testnet.json', import.meta.url), 'utf8'));
  assert.equal(REGISTRY_ADDRESS, d.address);
  assert.equal(d.chainId, 10143);
});

test('reason code follows the most severe known factor', () => {
  const code = pickReasonCode([
    { title: 'Very Recent Wallet', severity: 'medium' },
    { title: 'One-Way Outflow Pattern', severity: 'high' },
    { title: 'Something New', severity: 'critical' },
  ]);
  assert.equal(code, 4);
  assert.equal(pickReasonCode([{ title: 'No Significant Risk Patterns', severity: 'low' }]), 0);
});

test('every reason code the contract accepts has a label', () => {
  assert.equal(REASON_LABELS.length, 9); // 0..MAX_REASON_CODE (8)
});
