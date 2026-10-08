// Deploys the RiskAwarePayout example to Monad Testnet (chain 10143) and checks it against the live registry and guard.
// Run:  npx hardhat run scripts/deploy-example.cjs --network monadTestnet
// The private key is read from .env by hardhat.config.cjs and is never printed.
const fs = require('node:fs');
const path = require('node:path');
const { ethers, network } = require('hardhat');

const MAX_AVERAGE = 60; // this example's own, stricter rule: flag from an average of 60 with 1 reporter
const MIN_REPORTERS = 1;

async function expectRevert(label, promise, errorName, iface) {
  try {
    await promise;
    console.log(`FAIL  ${label}: it did not revert`);
    process.exitCode = 1;
  } catch (e) {
    const name = e.revert?.name ?? (typeof e.data === 'string' ? iface.parseError(e.data)?.name : null) ?? String(e.shortMessage || e.message).slice(0, 60);
    console.log(`${name === errorName ? 'ok  ' : 'FAIL'}  ${label}: reverted with ${name}`);
    if (name !== errorName) process.exitCode = 1;
  }
}

async function main() {
  if (network.name !== 'monadTestnet') throw new Error(`Use --network monadTestnet (got "${network.name}").`);
  const [me] = await ethers.getSigners().catch(() => []);
  if (!me) throw new Error('No deployer wallet: DEPLOYER_PRIVATE_KEY in .env is empty or malformed.');
  const file = path.join(__dirname, '..', 'deployments', 'monad-testnet.json');
  const rec = JSON.parse(fs.readFileSync(file, 'utf8'));

  const args = [rec.address, rec.guardedPay.address, MAX_AVERAGE, MIN_REPORTERS];
  const payout = await (await ethers.getContractFactory('RiskAwarePayout')).deploy(...args);
  await payout.waitForDeployment();
  const address = await payout.getAddress();
  console.log('RiskAwarePayout:', address, '| tx', payout.deploymentTransaction().hash);

  rec.examples = { riskAwarePayout: { address, deployTx: payout.deploymentTransaction().hash, constructorArgs: args } };
  fs.writeFileSync(file, JSON.stringify(rec, null, 2) + '\n');

  const value = ethers.parseEther('0.001');
  const system = '0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e';
  const guardIface = (await ethers.getContractAt('GuardedPay', rec.guardedPay.address)).interface;

  await expectRevert('own policy flags the system account (65, 1 reporter)', payout.payIfNotFlagged.staticCall(system, { value }), 'RecipientFlagged', payout.interface);
  await expectRevert('own policy flags the demo address', payout.payIfNotFlagged.staticCall(rec.demo.target, { value }), 'RecipientFlagged', payout.interface);
  await expectRevert('guard path: confirmation needed (system account)', payout.payThroughGuard.staticCall(system, false, { value }), 'ConfirmationRequired', guardIface);
  await expectRevert('guard path: blocked even if acknowledged (demo address)', payout.payThroughGuard.staticCall(rec.demo.target, true, { value }), 'Blocked', guardIface);
  await payout.payThroughGuard.staticCall(system, true, { value });
  console.log('ok    guard path: acknowledged payment to the system account would go through');

  const fresh = ethers.Wallet.createRandom().address;
  const tx = await payout.payIfNotFlagged(fresh, { value });
  await tx.wait();
  console.log('ok    own policy: paid 0.001 MON to an unflagged fresh address, tx', tx.hash);
  console.log('Verify with: npx hardhat verify --network monadTestnet', address, ...args.map(String));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
