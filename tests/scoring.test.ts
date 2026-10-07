import test from 'node:test';
import assert from 'node:assert/strict';
import { assessWalletRisk, type WalletData } from '../src/lib/walletRisk.ts';
import { assessTxRisk, type TxData } from '../src/lib/txRisk.ts';

const ME = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';

function wallet(over: Partial<WalletData> = {}): WalletData {
  return { address: ME, network: 'monad-testnet', txCount: 40, tokenCount: 1, transactions: [], tokens: [], contractInteractions: [], ...over };
}

test('empty wallet is a caution with one signal', () => {
  const a = assessWalletRisk(wallet({ txCount: 0 }));
  assert.equal(a.score, 50);
  assert.equal(a.level, 'caution');
});

test('established varied wallet is low risk', () => {
  const a = assessWalletRisk(
    wallet({
      firstSeen: new Date(Date.now() - 200 * 86400000).toISOString(),
      contractInteractions: [{ address: OTHER, count: 3 }, { address: ME.replace('1', '3'), count: 2 }],
    })
  );
  assert.equal(a.level, 'safe');
});

test('score never exceeds 100', () => {
  const a = assessWalletRisk(
    wallet({
      txCount: 600,
      tokenCount: 80,
      firstSeen: new Date().toISOString(),
      transactions: Array.from({ length: 10 }, (_, i) => ({ hash: String(i), from: ME, to: '0x0000000000000000000000000000000000000000', value: '0', timeStamp: '1' })),
      contractInteractions: [{ address: OTHER, count: 600 }],
    })
  );
  assert.ok(a.score <= 100);
  assert.equal(a.level, 'danger');
});

function tx(over: Partial<TxData> = {}): TxData {
  return {
    hash: '0x' + 'a'.repeat(64), network: 'monad-testnet', blockNumber: 1, timeStamp: '1', from: ME, to: OTHER, value: '0',
    gas: '21000', gasPrice: '1', gasUsed: '21000', isSuccess: true, contractAddress: null, functionName: null, input: '0x',
    tokenTransfers: [], internalTxs: [], receiptStatus: '0x1', ...over,
  };
}

test('plain successful transfer is low risk', () => {
  assert.equal(assessTxRisk(tx()).level, 'safe');
});

test('failed deployment to nowhere raises the score', () => {
  const a = assessTxRisk(tx({ isSuccess: false, to: '' }));
  assert.equal(a.score, 65);
  assert.equal(a.level, 'caution');
});
