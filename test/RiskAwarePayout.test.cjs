const { expect } = require('chai');
const { ethers } = require('hardhat');

const ONE = ethers.parseEther('1');

describe('RiskAwarePayout (example of building on RiskRegistry and GuardedPay)', () => {
  let registry, guard, payout, payer, r1, r2, target;

  beforeEach(async () => {
    [payer, r1, r2, target] = await ethers.getSigners();
    registry = await (await ethers.getContractFactory('RiskRegistry')).deploy();
    // GuardedPay as deployed on testnet: confirm from 40 (1 reporter), block from 70 (2 reporters)
    guard = await (await ethers.getContractFactory('GuardedPay')).deploy(await registry.getAddress(), 40, 70, 1, 2);
    // This example's OWN policy is stricter: flag from an average of 50 with 1 reporter
    payout = await (await ethers.getContractFactory('RiskAwarePayout')).deploy(await registry.getAddress(), await guard.getAddress(), 50, 1);
  });

  it('pattern 1: pays an address nobody has flagged and forwards the exact amount', async () => {
    await expect(payout.payIfNotFlagged(target.address, { value: ONE })).to.changeEtherBalances([payer, target], [-ONE, ONE]);
    expect(await ethers.provider.getBalance(await payout.getAddress())).to.equal(0);
  });

  it('pattern 1: applies its own, stricter rule (the guard alone would only ask for a confirmation here)', async () => {
    await registry.connect(r1).report(target.address, 55, 4);
    const [flagged, avg, reporters] = await payout.isFlagged(target.address);
    expect(flagged).to.equal(true);
    expect(avg).to.equal(55);
    expect(reporters).to.equal(1);
    await expect(payout.payIfNotFlagged(target.address, { value: ONE })).to.be.revertedWithCustomError(payout, 'RecipientFlagged').withArgs(55, 1);
    // the same address passes the guard once the payer acknowledges the risk
    await expect(guard.pay(target.address, true, { value: ONE })).to.changeEtherBalance(target, ONE);
  });

  it('pattern 1: a low average does not flag, and it follows the registry when a signal is retracted', async () => {
    await registry.connect(r1).report(target.address, 30, 0);
    expect((await payout.isFlagged(target.address))[0]).to.equal(false);
    await registry.connect(r2).report(target.address, 90, 5);
    expect((await payout.isFlagged(target.address))[0]).to.equal(true); // average 60
    await registry.connect(r2).retract(target.address);
    expect((await payout.isFlagged(target.address))[0]).to.equal(false);
  });

  it('pattern 2: forwards through GuardedPay and lets its errors bubble up', async () => {
    await expect(payout.payThroughGuard(target.address, false, { value: ONE })).to.changeEtherBalance(target, ONE);

    await registry.connect(r1).report(target.address, 60, 3);
    await expect(payout.payThroughGuard(target.address, false, { value: ONE })).to.be.revertedWithCustomError(guard, 'ConfirmationRequired');
    await expect(payout.payThroughGuard(target.address, true, { value: ONE })).to.changeEtherBalance(target, ONE);

    await registry.connect(r2).report(target.address, 90, 5);
    await expect(payout.payThroughGuard(target.address, true, { value: ONE })).to.be.revertedWithCustomError(guard, 'Blocked');
  });

  it('rejects a zero payment and keeps no funds', async () => {
    await expect(payout.payIfNotFlagged(target.address)).to.be.revertedWithCustomError(payout, 'NoValue');
    await expect(payout.payThroughGuard(target.address, false)).to.be.revertedWithCustomError(guard, 'NoValue');
    await expect(payer.sendTransaction({ to: await payout.getAddress(), value: 1n })).to.be.reverted;
  });
});
