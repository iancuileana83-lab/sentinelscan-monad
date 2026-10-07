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

import { activityByDay, scoreHistogram } from '../server/registryFeed.ts';

test('activity per day covers the window, zeros included, and counts each kind', () => {
  const now = Date.UTC(2026, 9, 10, 15, 0, 0);
  const t = (d: number, h = 12) => Date.UTC(2026, 9, d, h) / 1000;
  const rows = activityByDay(
    [
      { kind: 'recorded', time: t(10) },
      { kind: 'recorded', time: t(10, 1) },
      { kind: 'retracted', time: t(9) },
      { kind: 'recorded', time: t(1) }, // outside a 7-day window
    ],
    7,
    now
  );
  assert.equal(rows.length, 7);
  assert.equal(rows[6].day, '2026-10-10');
  assert.equal(rows[6].recorded, 2);
  assert.equal(rows[5].retracted, 1);
  assert.equal(rows.reduce((a, r) => a + r.recorded + r.retracted, 0), 3);
});

test('score histogram puts 100 in the last bucket and every score in exactly one', () => {
  const h = scoreHistogram([0, 9, 10, 65, 99, 100]);
  assert.equal(h.length, 10);
  assert.equal(h[0].count, 2);
  assert.equal(h[1].count, 1);
  assert.equal(h[6].count, 1);
  assert.equal(h[9].count, 2);
  assert.equal(h.reduce((a, b) => a + b.count, 0), 6);
});

import { eventFromLog } from '../server/events.ts';
import { readPage } from '../server/hypersync.ts';
import { Interface } from 'ethers';
import { REGISTRY_ABI } from '../src/lib/registryAbi.ts';

test('HyperSync logs decode to the same events as the explorer path, in either field style', () => {
  const iface = new Interface(REGISTRY_ABI);
  const subject = '0x' + '5'.repeat(40);
  const reporter = '0x' + 'a'.repeat(40);
  const enc = iface.encodeEventLog(iface.getEvent('SignalRecorded')!, [subject, reporter, 77, 3, 1]);
  const topic0 = enc.topics[0];
  const stamps = new Map([[100, 1_700_000_000]]);

  const snake = readPage({
    data: [{ blocks: [{ number: 100, timestamp: '0x6553f100' }], logs: [{ topic0: enc.topics[0], topic1: enc.topics[1], topic2: enc.topics[2], topic3: null, data: enc.data, block_number: 100, log_index: 2, transaction_hash: '0xabc' }] }],
  });
  const camel = readPage({ data: [{ logs: [{ topics: enc.topics, data: enc.data, blockNumber: '0x64', logIndex: '0x2', transactionHash: '0xabc' }] }] });
  for (const page of [snake, camel]) {
    assert.equal(page.logs.length, 1);
    const ev = eventFromLog(page.logs[0], stamps)!;
    assert.equal(ev.kind, 'recorded');
    assert.equal(ev.score, 77);
    assert.equal(ev.reasonCode, 3);
    assert.equal(ev.subject.toLowerCase(), subject);
    assert.equal(ev.time, 1_700_000_000);
    assert.equal(ev.order, 100_000_002);
    assert.equal(ev.txHash, '0xabc');
  }
  assert.equal(snake.timestamps.get(100), 0x6553f100);
  assert.equal(eventFromLog({ topics: ['0x' + '1'.repeat(64)], data: '0x', block: 1, logIndex: 0, txHash: '' }, stamps), null);
  assert.ok(topic0.startsWith('0x'));
});
