require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');

module.exports = {
  solidity: "0.8.0",  // Adjust to the version you're using
  networks: {
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY`,  // Replace with your Alchemy URL
      accounts: [`0x${YOUR_PRIVATE_KEY}`]  // Replace with your wallet's private key
    }
  },
  etherscan: {
    apiKey: 'YOUR_ETHERSCAN_API_KEY'  // Optional if you want to verify contracts
  }
};
