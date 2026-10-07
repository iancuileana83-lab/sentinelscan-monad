const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('RiskRegistry', () => {
  let registry, alice, bob, carol, subject;

  beforeEach(async () => {
    [alice, bob, carol, subject] = await ethers.getSigners();
    registry = await (await ethers.getContractFactory('RiskRegistry')).deploy();
  });

  it('starts empty', async () => {
    const [count, avg, last] = await registry.getSummary(subject.address);
    expect(count).to.equal(0);
    expect(avg).to.equal(0);
    expect(last).to.equal(0);
  });

  it('records a signal and emits an event', async () => {
    await expect(registry.connect(alice).report(subject.address, 72, 4))
      .to.emit(registry, 'SignalRecorded')
      .withArgs(subject.address, alice.address, 72, 4, 1);
    const [count, avg] = await registry.getSummary(subject.address);
    expect(count).to.equal(1);
    expect(avg).to.equal(72);
    const [score, reason, at] = await registry.getSignal(subject.address, alice.address);
    expect(score).to.equal(72);
    expect(reason).to.equal(4);
    expect(at).to.be.gt(0);
  });

  it('averages over distinct reporters', async () => {
    await registry.connect(alice).report(subject.address, 80, 1);
    await registry.connect(bob).report(subject.address, 40, 3);
    const [count, avg] = await registry.getSummary(subject.address);
    expect(count).to.equal(2);
    expect(avg).to.equal(60);
  });

  it('reporting again updates your own signal instead of adding another', async () => {
    await registry.connect(alice).report(subject.address, 80, 1);
    await registry.connect(alice).report(subject.address, 20, 2);
    const [count, avg] = await registry.getSummary(subject.address);
    expect(count).to.equal(1);
    expect(avg).to.equal(20);
    const [, reason] = await registry.getSignal(subject.address, alice.address);
    expect(reason).to.equal(2);
  });

  it('lets a reporter retract only their own signal', async () => {
    await registry.connect(alice).report(subject.address, 80, 1);
    await registry.connect(bob).report(subject.address, 40, 3);
    await expect(registry.connect(alice).retract(subject.address))
      .to.emit(registry, 'SignalRetracted')
      .withArgs(subject.address, alice.address, 1);
    const [count, avg] = await registry.getSummary(subject.address);
    expect(count).to.equal(1);
    expect(avg).to.equal(40);
    const [, , at] = await registry.getSignal(subject.address, alice.address);
    expect(at).to.equal(0);
    // carol never reported, so she cannot remove bob's signal
    await expect(registry.connect(carol).retract(subject.address)).to.be.revertedWithCustomError(registry, 'NoSignalToRetract');
  });

  it('rejects bad input', async () => {
    await expect(registry.report(ethers.ZeroAddress, 10, 0)).to.be.revertedWithCustomError(registry, 'InvalidSubject');
    await expect(registry.connect(alice).report(alice.address, 10, 0)).to.be.revertedWithCustomError(registry, 'InvalidSubject');
    await expect(registry.report(subject.address, 101, 0)).to.be.revertedWithCustomError(registry, 'ScoreTooHigh');
    await expect(registry.report(subject.address, 50, 9)).to.be.revertedWithCustomError(registry, 'UnknownReasonCode');
  });

  it('accepts the boundary values', async () => {
    await registry.connect(alice).report(subject.address, 100, 8);
    await registry.connect(bob).report(subject.address, 0, 0);
    const [count, avg] = await registry.getSummary(subject.address);
    expect(count).to.equal(2);
    expect(avg).to.equal(50);
  });

  it('does not accept native funds', async () => {
    await expect(alice.sendTransaction({ to: await registry.getAddress(), value: 1n })).to.be.reverted;
  });
});
