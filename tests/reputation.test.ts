import test from 'node:test';
import assert from 'node:assert/strict';
import { reputationWeight, summarize, WEIGHT_FLOOR } from '../server/reputation.ts';
import { applyEvents, type RawEvent } from '../server/events.ts';

test('a brand-new, silent wallet gets exactly the floor weight', () => {
  const w = reputationWeight({ ageDays: 0, transactions: 0, reportsMade: 1 });
  assert.equal(w.weight, WEIGHT_FLOOR);
});

test('an old, active wallet gets full weight', () => {
  const w = reputationWeight({ ageDays: 90, transactions: 200, reportsMade: 3 });
  assert.equal(w.weight, 1);
});

test('weight grows with age and with activity, and stays within the floor and 1', () => {
  let last = 0;
  for (const ageDays of [0, 3, 10, 20, 30, 60]) {
    const w = reputationWeight({ ageDays, transactions: 10, reportsMade: 1 }).weight;
    assert.ok(w >= last, `age ${ageDays}`);
    assert.ok(w >= WEIGHT_FLOOR && w <= 1);
    last = w;
  }
  last = 0;
  for (const transactions of [0, 1, 5, 20, 50, 500]) {
    const w = reputationWeight({ ageDays: 30, transactions, reportsMade: 1 }).weight;
    assert.ok(w >= last, `tx ${transactions}`);
    last = w;
  }
});

test('spraying signals at many addresses lowers a reporter\'s weight', () => {
  const calm = reputationWeight({ ageDays: 60, transactions: 100, reportsMade: 5 }).weight;
  const spammy = reputationWeight({ ageDays: 60, transactions: 100, reportsMade: 100 }).weight;
  assert.ok(spammy < calm);
  assert.ok(spammy >= WEIGHT_FLOOR);
});

test('weights ignore nonsense input safely', () => {
  const w = reputationWeight({ ageDays: -5, transactions: -3, reportsMade: 0 });
  assert.equal(w.weight, WEIGHT_FLOOR);
});

test('weighted average lets one trusted reporter outweigh several brand-new ones', () => {
  const s = summarize([
    { score: 90, weight: 1 },
    { score: 10, weight: WEIGHT_FLOOR },
    { score: 10, weight: WEIGHT_FLOOR },
    { score: 10, weight: WEIGHT_FLOOR },
  ]);
  assert.equal(s.plainAverage, 30);
  assert.ok(s.weightedAverage! > 60);
  assert.ok(s.effectiveReporters < 4 && s.effectiveReporters > 1);
});

test('equal weights give the plain average and the full reporter count', () => {
  const s = summarize([
    { score: 20, weight: 0.5 },
    { score: 40, weight: 0.5 },
  ]);
  assert.equal(s.weightedAverage, 30);
  assert.equal(s.plainAverage, 30);
  assert.equal(s.effectiveReporters, 2);
});

test('no signals means no average', () => {
  const s = summarize([]);
  assert.equal(s.weightedAverage, null);
  assert.equal(s.effectiveReporters, 0);
});

const A = '0x' + 'a'.repeat(40);
const B = '0x' + 'b'.repeat(40);
const S = '0x' + '5'.repeat(40);
const ev = (kind: RawEvent['kind'], reporter: string, order: number, score = 50): RawEvent => ({
  kind, subject: S, reporter, score: kind === 'recorded' ? score : undefined, reasonCode: kind === 'recorded' ? 1 : undefined, time: order, order,
});

test('event replay: overwrite, retract and re-record are applied in order', () => {
  const live = applyEvents([
    ev('recorded', A, 3, 80), // later in the list but earlier in time order is sorted by `order`
    ev('recorded', A, 1, 20),
    ev('recorded', B, 2, 60),
    ev('retracted', B, 4),
  ]);
  assert.equal(live.length, 1);
  assert.equal(live[0].reporter, A);
  assert.equal(live[0].score, 80);
  const again = applyEvents([ev('recorded', B, 1), ev('retracted', B, 2), ev('recorded', B, 3, 90)]);
  assert.equal(again.length, 1);
  assert.equal(again[0].score, 90);
});

test('event replay treats addresses case-insensitively', () => {
  const live = applyEvents([ev('recorded', A.toUpperCase().replace('0X', '0x'), 1, 10), ev('retracted', A, 2)]);
  assert.equal(live.length, 0);
});
