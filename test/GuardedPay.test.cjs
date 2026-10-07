const { expect } = require('chai');
const { ethers } = require('hardhat');

const ALLOW = 0n;
const CONFIRM = 1n;
const BLOCK = 2n;
const ONE = ethers.parseEther('1');

describe('GuardedPay', () => {
  let registry, guard, payer, r1, r2, r3, target;

  beforeEach(async () => {
    [payer, r1, r2, r3, target] = await ethers.getSigners();
    registry = await (await ethers.getContractFactory('RiskRegistry')).deploy();
    // confirm from 40 with 1 reporter, block from 70 with 2 reporters
    guard = await (await ethers.getContractFactory('GuardedPay')).deploy(await registry.getAddress(), 40, 70, 1, 2);
  });

  it('allows an address nobody has reported and forwards the exact amount', async () => {
    const [decision, avg, reporters] = await guard.quote(target.address);
    expect(decision).to.equal(ALLOW);
    expect(reporters).to.equal(0);
    await expect(guard.pay(target.address, false, { value: ONE })).to.changeEtherBalances([payer, target], [-ONE, ONE]);
    expect(await ethers.provider.getBalance(await guard.getAddress())).to.equal(0);
  });

  it('emits Paid with the decision that applied', async () => {
    await expect(guard.pay(target.address, false, { value: ONE }))
      .to.emit(guard, 'Paid')
      .withArgs(payer.address, target.address, ONE, ALLOW, 0, 0);
  });

  it('allows a low average score even with reporters', async () => {
    await registry.connect(r1).report(target.address, 20, 0);
    await registry.connect(r2).report(target.address, 30, 0);
    const [decision] = await guard.quote(target.address);
    expect(decision).to.equal(ALLOW);
    await guard.pay(target.address, false, { value: ONE });
  });

  it('asks for confirmation at the confirm score, and pays once acknowledged', async () => {
    await registry.connect(r1).report(target.address, 55, 4);
    const [decision, avg, reporters] = await guard.quote(target.address);
    expect(decision).to.equal(CONFIRM);
    expect(avg).to.equal(55);
    expect(reporters).to.equal(1);
    await expect(guard.pay(target.address, false, { value: ONE })).to.be.revertedWithCustomError(guard, 'ConfirmationRequired').withArgs(55, 1);
    await expect(guard.pay(target.address, true, { value: ONE }))
      .to.emit(guard, 'Paid')
      .withArgs(payer.address, target.address, ONE, CONFIRM, 55, 1);
  });

  it('one reporter, however high the score, can only force a confirmation, never a block', async () => {
    await registry.connect(r1).report(target.address, 100, 5);
    const [decision] = await guard.quote(target.address);
    expect(decision).to.equal(CONFIRM);
    await guard.pay(target.address, true, { value: ONE });
  });

  it('blocks when enough reporters agree on a high score, even if acknowledged', async () => {
    await registry.connect(r1).report(target.address, 90, 5);
    await registry.connect(r2).report(target.address, 80, 5);
    const [decision, avg, reporters] = await guard.quote(target.address);
    expect(decision).to.equal(BLOCK);
    expect(avg).to.equal(85);
    expect(reporters).to.equal(2);
    await expect(guard.pay(target.address, true, { value: ONE })).to.be.revertedWithCustomError(guard, 'Blocked').withArgs(85, 2);
    await expect(guard.pay(target.address, false, { value: ONE })).to.be.revertedWithCustomError(guard, 'Blocked');
  });

  it('follows the registry: a retracted signal lifts the block', async () => {
    await registry.connect(r1).report(target.address, 90, 5);
    await registry.connect(r2).report(target.address, 90, 5);
    expect((await guard.quote(target.address))[0]).to.equal(BLOCK);
    await registry.connect(r2).retract(target.address);
    expect((await guard.quote(target.address))[0]).to.equal(CONFIRM);
  });

  it('rejects a zero value, the zero address and itself as recipient', async () => {
    await expect(guard.pay(target.address, false)).to.be.revertedWithCustomError(guard, 'NoValue');
    await expect(guard.pay(ethers.ZeroAddress, false, { value: 1n })).to.be.revertedWithCustomError(guard, 'InvalidRecipient');
    await expect(guard.pay(await guard.getAddress(), false, { value: 1n })).to.be.revertedWithCustomError(guard, 'InvalidRecipient');
  });

  it('reverts as a whole when the recipient refuses the payment', async () => {
    // The registry contract has no receive function, so it rejects plain transfers.
    await expect(guard.pay(await registry.getAddress(), false, { value: ONE })).to.be.revertedWithCustomError(guard, 'TransferFailed');
    expect(await ethers.provider.getBalance(await guard.getAddress())).to.equal(0);
  });

  it('does not accept plain transfers and keeps no funds', async () => {
    await expect(payer.sendTransaction({ to: await guard.getAddress(), value: 1n })).to.be.reverted;
  });

  it('refuses nonsensical settings', async () => {
    const f = await ethers.getContractFactory('GuardedPay');
    const reg = await registry.getAddress();
    await expect(f.deploy(ethers.ZeroAddress, 40, 70, 1, 2)).to.be.revertedWithCustomError(f, 'BadSettings');
    await expect(f.deploy(reg, 80, 70, 1, 2)).to.be.revertedWithCustomError(f, 'BadSettings');
    await expect(f.deploy(reg, 40, 101, 1, 2)).to.be.revertedWithCustomError(f, 'BadSettings');
    await expect(f.deploy(reg, 40, 70, 0, 2)).to.be.revertedWithCustomError(f, 'BadSettings');
    await expect(f.deploy(reg, 40, 70, 3, 2)).to.be.revertedWithCustomError(f, 'BadSettings');
  });
});
