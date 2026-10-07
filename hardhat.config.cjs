require('@nomicfoundation/hardhat-toolbox');
// quiet: do not print anything about .env, and never print its values.
require('dotenv').config({ quiet: true });

const key = process.env.DEPLOYER_PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.28',
    settings: { evmVersion: 'cancun', optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    // The only public network this project is allowed to use: Monad Testnet.
    monadTestnet: {
      url: process.env.MONAD_RPC_URL || 'https://rpc-testnet.monadinfra.com',
      chainId: 10143,
      accounts: key && /^(0x)?[0-9a-fA-F]{64}$/.test(key) ? [key.startsWith('0x') ? key : `0x${key}`] : [],
    },
  },
};
