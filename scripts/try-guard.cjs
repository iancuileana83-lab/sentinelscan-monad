// Exercises the deployed GuardedPay on Monad Testnet with the throwaway wallet:
// dry runs for the Block and Confirm cases (nothing is sent), then one tiny real payment for the Allow case.
// Run:  npx hardhat run scripts/try-guard.cjs --network monadTestnet
const fs = require('node:fs');
const path = require('node:path');
const { ethers, network } = require('hardhat');

async function expectRevert(guard, label, promise, errorName) {
  try {
    await promise;
    console.log(`FAIL  ${label}: it did not revert`);
    process.exitCode = 1;
  } catch (e) {
    const decoded = typeof e.data === 'string' ? guard.interface.parseError(e.data) : null;
    const name = e.revert?.name ?? decoded?.name ?? (e.shortMessage || e.message).slice(0, 80);
    console.log(`${name === errorName ? 'ok  ' : 'FAIL'}  ${label}: reverted with ${name}`);
    if (name !== errorName) process.exitCode = 1;
  }
}

async function main() {
  if (network.name !== 'monadTestnet') throw new Error('Use --network monadTestnet.');
  const [me] = await ethers.getSigners();
  const record = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deployments', 'monad-testnet.json'), 'utf8'));
  const guard = await ethers.getContractAt('GuardedPay', record.guardedPay.address, me);
  const value = ethers.parseEther('0.001');
  const system = '0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e';

  await expectRevert(guard, 'Block   (demo address, acknowledged)', guard.pay.staticCall(record.demo.target, true, { value }), 'Blocked');
  await expectRevert(guard, 'Confirm (system account, not acknowledged)', guard.pay.staticCall(system, false, { value }), 'ConfirmationRequired');
  await guard.pay.staticCall(system, true, { value });
  console.log('ok    Confirm (system account, acknowledged): a dry run succeeds');

  const fresh = ethers.Wallet.createRandom().address;
  const tx = await guard.pay(fresh, false, { value });
  const receipt = await tx.wait();
  console.log('ok    Allow   (fresh address): paid 0.001 MON, tx', tx.hash, '| balance there:', ethers.formatEther(await ethers.provider.getBalance(fresh)));
  console.log('guard holds', ethers.formatEther(await ethers.provider.getBalance(record.guardedPay.address)), 'MON (should be 0)', '| gas', receipt.gasUsed.toString());
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
