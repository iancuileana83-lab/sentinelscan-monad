// Creates ONE demo address and two test reporters so the on-chain guard has a clear "Block" case to show.
// The demo address is freshly generated (its key is discarded), holds nothing and is labelled as a demo
// everywhere in the app. Reporter B is a throwaway wallet funded with a tiny amount of testnet MON.
// Run:  npx hardhat run scripts/seed-demo.cjs --network monadTestnet
const fs = require('node:fs');
const path = require('node:path');
const { ethers, network } = require('hardhat');

async function main() {
  if (network.name !== 'monadTestnet') throw new Error(`Refusing to run on "${network.name}". Use --network monadTestnet.`);
  const [deployer] = await ethers.getSigners().catch(() => []);
  if (!deployer) throw new Error('No deployer wallet: DEPLOYER_PRIVATE_KEY in .env is empty or malformed.');

  const file = path.join(__dirname, '..', 'deployments', 'monad-testnet.json');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (record.demo) throw new Error('Demo already seeded: ' + record.demo.target);

  const registry = await ethers.getContractAt('RiskRegistry', record.address, deployer);
  const target = ethers.Wallet.createRandom().address; // key discarded on purpose
  const reporterB = ethers.Wallet.createRandom().connect(ethers.provider); // key discarded when this script ends

  console.log('Demo target :', target);
  console.log('Reporter B  :', reporterB.address);

  await (await registry.report(target, 88, 4)).wait();
  console.log('Reporter A (deployer) recorded 88');

  await (await deployer.sendTransaction({ to: reporterB.address, value: ethers.parseEther('0.05') })).wait();
  await (await registry.connect(reporterB).report(target, 82, 3)).wait();
  console.log('Reporter B recorded 82');

  const [count, avg] = await registry.getSummary(target);
  console.log('Registry now says: reporters', count.toString(), 'average', avg.toString());

  record.demo = { target, reporterB: reporterB.address, note: 'Demo address generated for the demo; its key was discarded. Signals were recorded by two test wallets.' };
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
