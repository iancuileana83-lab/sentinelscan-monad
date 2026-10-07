// Deploys RiskRegistry to Monad Testnet (chain 10143) and nothing else.
// Run:  npx hardhat run scripts/deploy.cjs --network monadTestnet
// The private key is read from .env by hardhat.config.cjs and is never printed.
const fs = require('node:fs');
const path = require('node:path');
const { ethers, network } = require('hardhat');

async function main() {
  if (network.name !== 'monadTestnet') {
    throw new Error(`Refusing to deploy on "${network.name}". Use --network monadTestnet.`);
  }
  const [deployer] = await ethers.getSigners().catch(() => []);
  if (!deployer) throw new Error('No deployer wallet: DEPLOYER_PRIVATE_KEY in .env is empty or malformed.');

  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (chainId !== 10143n) throw new Error(`Wrong chain ${chainId}. Expected Monad Testnet (10143).`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer address :', deployer.address);
  console.log('Balance          :', ethers.formatEther(balance), 'MON (testnet)');
  if (balance === 0n) throw new Error('Balance is 0. Get free testnet MON from https://faucet.monad.xyz first.');

  const factory = await ethers.getContractFactory('RiskRegistry');
  const registry = await factory.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  const tx = registry.deploymentTransaction();

  console.log('RiskRegistry     :', address);
  console.log('Deploy tx        :', tx.hash);
  console.log('Explorer         : https://testnet.monadscan.com/address/' + address);

  const out = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    path.join(out, 'monad-testnet.json'),
    JSON.stringify({ chainId: 10143, contract: 'RiskRegistry', address, deployTx: tx.hash, deployer: deployer.address }, null, 2) + '\n'
  );
  console.log('Saved public details to deployments/monad-testnet.json');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
