// require("@nomicfoundation/hardhat-toolbox");
// require("@nomicfoundation/hardhat-chai-matchers"); 

// require("dotenv").config();

// console.log("Alchemy API Key:", process.env.ALCHEMY_API_KEY);
// console.log("Private Key Loaded:", process.env.PRIVATE_KEY ? "Yes" : "No");

// module.exports = {
//   networks: {
//     sepolia: {
//       url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
//       accounts: [`0x${process.env.PRIVATE_KEY}`],  
//     },
//   },
//   solidity: "0.8.28",
//   paths: {
//     sources: "./contracts",   
//     cache: "./cache",
//     artifacts: "./artifacts"  
//   }
// };
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

console.log("Alchemy API Key:", process.env.ALCHEMY_API_KEY);
console.log("Private Key Loaded:", process.env.PRIVATE_KEY ? "Yes" : "No");

module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY,
    },
  },
  paths: {
    sources: "./contracts",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};