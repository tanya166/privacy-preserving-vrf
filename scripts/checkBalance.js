require("dotenv").config();
const { ethers } = require("ethers"); // Correct import

async function main() {
    // Correct provider initialization
    const provider = new ethers.providers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log("Checking balance for address:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.utils.formatEther(balance), "ETH"); // Corrected syntax for ethers v6
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
