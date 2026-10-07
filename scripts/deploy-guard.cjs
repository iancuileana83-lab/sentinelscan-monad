// Deploys GuardedPay to Monad Testnet (chain 10143) in front of the existing RiskRegistry.
// Run:  npx hardhat run scripts/deploy-guard.cjs --network monadTestnet
// The private key is read from .env by hardhat.config.cjs and is never printed.
const fs = require('node:fs');
const path = require('node:path');
const { ethers, network } = require('hardhat');

const CONFIRM_SCORE = 40;
const BLOCK_SCORE = 70;
const MIN_REPORTERS_TO_CONFIRM = 1;
const MIN_REPORTERS_TO_BLOCK = 2;

async function main() {
  if (network.name !== 'monadTestnet') throw new Error(`Refusing to deploy on "${network.name}". Use --network monadTestnet.`);
  const [deployer] = await ethers.getSigners().catch(() => []);
  if (!deployer) throw new Error('No deployer wallet: DEPLOYER_PRIVATE_KEY in .env is empty or malformed.');
  if ((await ethers.provider.getNetwork()).chainId !== 10143n) throw new Error('Wrong chain. Expected Monad Testnet (10143).');

  const file = path.join(__dirname, '..', 'deployments', 'monad-testnet.json');
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer :', deployer.address, '| balance', ethers.formatEther(balance), 'MON (testnet)');
  if (balance === 0n) throw new Error('Balance is 0. Get free testnet MON from https://faucet.monad.xyz first.');

  const args = [record.address, CONFIRM_SCORE, BLOCK_SCORE, MIN_REPORTERS_TO_CONFIRM, MIN_REPORTERS_TO_BLOCK];
  const guard = await (await ethers.getContractFactory('GuardedPay')).deploy(...args);
  await guard.waitForDeployment();
  const address = await guard.getAddress();
  console.log('GuardedPay:', address);
  console.log('Deploy tx :', guard.deploymentTransaction().hash);

  record.guardedPay = { address, deployTx: guard.deploymentTransaction().hash, constructorArgs: args };
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  console.log('Saved to deployments/monad-testnet.json');
  console.log('Verify with: npx hardhat verify --network monadTestnet ' + address + ' ' + args.join(' '));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
