import test from 'node:test';
import assert from 'node:assert/strict';
import { assessTxRisk, type TxData } from '../src/lib/txRisk.ts';
import { assessWalletRisk, type WalletData } from '../src/lib/walletRisk.ts';
import { TX_RULES, WALLET_RULES } from '../src/lib/rules.ts';

const ME = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const NULL = '0x0000000000000000000000000000000000000000';
const OLD = new Date(Date.now() - 400 * 86400000).toISOString();

const wallet = (over: Partial<WalletData> = {}): WalletData => ({
  address: ME, network: 'monad-testnet', txCount: 40, tokenCount: 1, transactions: [], tokens: [],
  contractInteractions: [{ address: OTHER, count: 3 }, { address: '0x3333333333333333333333333333333333333333', count: 2 }],
  firstSeen: OLD, ...over,
});
const tx = (over: Partial<TxData> = {}): TxData => ({
  hash: '0x' + 'a'.repeat(64), network: 'monad-testnet', blockNumber: 1, timeStamp: '1', from: ME, to: OTHER, value: '0', gas: '21000', gasPrice: '1',
  gasUsed: '21000', isSuccess: true, contractAddress: null, functionName: null, input: '0x', tokenTransfers: [], internalTxs: [], receiptStatus: '0x1', ...over,
});
const score = (r: { score: number }) => r.score;

test('wallet rule points on the How-it-works page match the scoring code', () => {
  assert.equal(score(assessWalletRisk(wallet({ txCount: 0 }))), 50);
  assert.equal(score(assessWalletRisk(wallet({ txCount: 3 }))), 25);
  assert.equal(score(assessWalletRisk(wallet({ txCount: 15 }))), 10);
  assert.equal(score(assessWalletRisk(wallet({ firstSeen: new Date(Date.now() - 3 * 86400000).toISOString() }))), 25);
  assert.equal(score(assessWalletRisk(wallet({ firstSeen: new Date(Date.now() - 15 * 86400000).toISOString() }))), 10);
  assert.equal(score(assessWalletRisk(wallet({ tokenCount: 60 }))), 10);
  assert.equal(score(assessWalletRisk(wallet({ contractInteractions: [{ address: OTHER, count: 12 }, { address: NULL.replace('0', '4'), count: 1 }] }))), 5);
  assert.equal(score(assessWalletRisk(wallet({ contractInteractions: [{ address: OTHER, count: 12 }] }))), 25); // 5 + single counterparty 20
  assert.equal(
    score(assessWalletRisk(wallet({ transactions: [{ hash: '1', from: ME, to: NULL, value: '0', timeStamp: '1' }] }))),
    30
  );
  const outgoing = Array.from({ length: 10 }, (_, i) => ({ hash: String(i), from: ME, to: OTHER, value: '0', timeStamp: '1' }));
  assert.equal(score(assessWalletRisk(wallet({ transactions: outgoing }))), 15);
});

test('transaction rule points on the page match the scoring code', () => {
  assert.equal(score(assessTxRisk(tx({ isSuccess: false }))), 40);
  assert.equal(score(assessTxRisk(tx({ to: '' }))), 25);
  assert.equal(score(assessTxRisk(tx({ to: NULL }))), 30);
  assert.equal(score(assessTxRisk(tx({ value: (101n * 10n ** 18n).toString() }))), 20);
  assert.equal(score(assessTxRisk(tx({ value: (11n * 10n ** 18n).toString() }))), 10);
  assert.equal(score(assessTxRisk(tx({ from: ME, to: ME }))), 15);
  assert.equal(score(assessTxRisk(tx({ gasUsed: '600000' }))), 10);
  assert.equal(score(assessTxRisk(tx({ input: '0x' + 'ab'.repeat(600) }))), 10);
  const internals = Array.from({ length: 6 }, () => ({ from: ME, to: OTHER, value: '0', type: 'call' }));
  assert.equal(score(assessTxRisk(tx({ internalTxs: internals }))), 15);
  const transfers = (n: number, from = OTHER) =>
    Array.from({ length: n }, () => ({ from, to: ME, value: '1', tokenName: 'T', tokenSymbol: 'T', tokenDecimal: '18', contractAddress: OTHER }));
  assert.equal(score(assessTxRisk(tx({ tokenTransfers: transfers(11) }))), 15);
});

test('the page lists a rule for every row it promises', () => {
  assert.equal(WALLET_RULES.length, 10);
  assert.equal(TX_RULES.length, 11);
  for (const r of [...WALLET_RULES, ...TX_RULES]) assert.ok(r.name && r.points && r.when);
});
