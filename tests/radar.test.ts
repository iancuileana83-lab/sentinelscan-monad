import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTx, summarizeBlock, type FlaggedAddress } from '../server/radar.ts';

const A = '0x' + 'a'.repeat(40);
const B = '0x' + 'b'.repeat(40);
const NULL = '0x' + '0'.repeat(40);
const none = new Map<string, FlaggedAddress>();
const tx = (over: Partial<{ hash: string; from: string; to: string | null; value: string }> = {}) => ({ hash: '0x' + '1'.repeat(64), from: A, to: B, value: '0x0', ...over });

test('an ordinary transfer is not flagged', () => {
  assert.equal(classifyTx(tx({ value: '0xde0b6b3a7640000' }), none), null);
});

test('paying an address with live signals is flagged, and high only when the guard would block', () => {
  const flagged = new Map([[B, { reporters: 2, averageScore: 85 }]]);
  assert.equal(classifyTx(tx(), flagged)?.level, 'high');
  const one = new Map([[B, { reporters: 1, averageScore: 85 }]]);
  assert.equal(classifyTx(tx(), one)?.level, 'medium');
  const low = new Map([[B, { reporters: 3, averageScore: 20 }]]);
  assert.equal(classifyTx(tx(), low), null);
});

test('null address, self transfer and large transfer are flagged with plain reasons', () => {
  assert.equal(classifyTx(tx({ to: NULL }), none)?.level, 'high');
  assert.match(classifyTx(tx({ to: A }), none)!.reasons[0], /same address/);
  const big = (101n * 10n ** 18n).toString(16);
  assert.match(classifyTx(tx({ value: '0x' + big }), none)!.reasons[0], /Large transfer of 101/);
});

test('contract deployments are counted, not flagged, and bad values never crash', () => {
  const b = summarizeBlock({ number: '0x10', timestamp: '0x64', gasUsed: '0x5208', transactions: [tx({ to: null }), tx({ value: 'nonsense' })] }, none);
  assert.equal(b.n, 16);
  assert.equal(b.t, 100);
  assert.equal(b.tx, 2);
  assert.equal(b.deployments, 1);
  assert.equal(b.hits.length, 0);
});

test('addresses are matched case-insensitively and hits per block are capped', () => {
  const flagged = new Map([[B.toLowerCase(), { reporters: 2, averageScore: 90 }]]);
  const many = Array.from({ length: 30 }, (_, i) => tx({ hash: '0x' + String(i).padStart(64, '0'), to: B.toUpperCase().replace('0X', '0x') }));
  const b = summarizeBlock({ number: '0x1', timestamp: '0x1', gasUsed: '0x1', transactions: many }, flagged);
  assert.equal(b.hits.length, 8);
  assert.equal(b.hits[0].level, 'high');
});
