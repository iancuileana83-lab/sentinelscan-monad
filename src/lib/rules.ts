// The scoring rules, written out for the "How it works" page. The points here are checked
// against the real scoring functions by tests/rules.test.ts, so the page cannot drift.
export interface Rule {
  name: string;
  points: string;
  when: string;
}

export const WALLET_RULES: Rule[] = [
  { name: 'No transaction history', points: '50 (alone)', when: 'The wallet has no transactions. The score is set to 50 and no other rule applies.' },
  { name: 'Very low activity', points: '+25', when: '1 to 5 transactions found.' },
  { name: 'Low activity', points: '+10', when: '6 to 20 transactions found.' },
  { name: 'Null-address interaction', points: '+30', when: 'A counterparty is the null address 0x000…000.' },
  { name: 'High-frequency counterparty', points: '+5 each, max +20', when: 'An address was interacted with 10 or more times.' },
  { name: 'Single counterparty dependency', points: '+20', when: 'Only one counterparty in more than 10 transactions.' },
  { name: 'One-way outflow', points: '+15', when: 'The latest 10 transactions (at least 5) are all outgoing.' },
  { name: 'Large token portfolio', points: '+10', when: 'More than 50 different tokens seen.' },
  { name: 'Very recent wallet', points: '+25', when: 'First transaction less than 7 days ago.' },
  { name: 'Recently created wallet', points: '+10', when: 'First transaction 7 to 30 days ago.' },
];

export const TX_RULES: Rule[] = [
  { name: 'Failed transaction', points: '+40', when: 'The transaction was reverted.' },
  { name: 'Contract deployment', points: '+25', when: 'The transaction creates a contract instead of calling one.' },
  { name: 'Null-address involvement', points: '+30', when: 'The null address appears as sender, receiver, or in transfers.' },
  { name: 'Large native transfer', points: '+20 (over 100 MON) or +10 (over 10 MON)', when: 'The transferred MON amount is above the threshold.' },
  { name: 'Large token transfers', points: '+10 each, max +20', when: 'A token transfer moves more than 10,000 units.' },
  { name: 'Many token transfers', points: '+15', when: 'More than 10 token transfers in one transaction.' },
  { name: 'Complex internal calls', points: '+15', when: 'More than 5 internal calls.' },
  { name: 'Large input data', points: '+10', when: 'The call data is longer than about 500 bytes.' },
  { name: 'Self-transfer', points: '+15', when: 'Sender and receiver are the same address.' },
  { name: 'One-way token distribution', points: '+15', when: 'More than 3 token transfers, all leaving the sender.' },
  { name: 'High gas use', points: '+10', when: 'More than 500,000 gas used.' },
];

export const LEVELS = [
  { range: '0 to 39', label: 'Low risk', meaning: 'No strong patterns found in the data we looked at.' },
  { range: '40 to 69', label: 'Caution', meaning: 'Several patterns worth a closer look. Often just a bot or payout account.' },
  { range: '70 to 100', label: 'High risk', meaning: 'Many patterns at once. Still a signal, not proof of anything.' },
];

export const LIMITS = [
  'Only the latest 100 transactions of a wallet are analyzed, not its full history. A "more than 500 transactions" rule from the original scanner therefore cannot trigger here.',
  'The rules are hand-written heuristics, not a trained model, and are tuned for demonstration. Real testnet traffic is mostly bots, so many wallets land in Caution.',
  'Monad Testnet was reset in December 2025, so almost every wallet counts as "recent". Treat the wallet-age signals as weak evidence.',
  'Reporters in the registry are anonymous wallets. Anyone can use many wallets. The reputation weights make cheap spam weaker; patient attackers can age wallets.',
  'The registry stores a score and a fixed reason code, not free text, so it cannot be used to publish accusations. It still holds opinions, not facts.',
  'Nothing here is financial advice, and nothing here has been audited. Testnet tokens have no real value.',
];
