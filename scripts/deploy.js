require("dotenv").config({ path: './.env' });
const { ethers } = require("ethers");
const fs = require("fs");

async function main() {

    const contractFile = fs.readFileSync("./artifacts/contracts/VRFStorage.sol/VRFStorage.json");
    const contractJson = JSON.parse(contractFile);
    const { abi, bytecode } = contractJson;

    const NETWORK = "sepolia";
    
    console.log("Environment check:");
    console.log("POLYGON_RPC:", process.env.POLYGON_RPC ? "defined" : "undefined");
    console.log("ALCHEMY_API_KEY:", process.env.ALCHEMY_API_KEY ? "defined" : "undefined");
    console.log("PRIVATE_KEY:", process.env.PRIVATE_KEY ? "defined" : "undefined");
    
    let provider, privateKey;
    
    if (NETWORK === "sepolia") {
        
        const rpcUrl = process.env.POLYGON_RPC || `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
        
        if (!rpcUrl || rpcUrl.includes('undefined')) {
            throw new Error("Neither POLYGON_RPC nor ALCHEMY_API_KEY found in environment variables");
        }
        if (!process.env.PRIVATE_KEY) {
            throw new Error("PRIVATE_KEY not found in environment variables");
        }
        
        provider = new ethers.JsonRpcProvider(rpcUrl);
        privateKey = process.env.PRIVATE_KEY.startsWith("0x") 
            ? process.env.PRIVATE_KEY 
            : `0x${process.env.PRIVATE_KEY}`;
        console.log("Deploying to Sepolia testnet");
        console.log("RPC URL:", rpcUrl.substring(0, 50) + "...");
    } else {
        provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        privateKey = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; 
        console.log("Deploying to local Hardhat network");
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    console.log("Deploying contracts with the account:", wallet.address);
    
    const balance = await provider.getBalance(wallet.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    const contractFactory = new ethers.ContractFactory(abi, bytecode, wallet);
    
    console.log("Deploying VRFStorage contract...");
    const contract = await contractFactory.deploy();
    
    console.log("Transaction hash:", contract.deploymentTransaction().hash);
    console.log("Waiting for deployment...");
    
    await contract.waitForDeployment();
    
    const contractAddress = await contract.getAddress();
    console.log("Contract deployed to:", contractAddress);
    
    console.log("Waiting for confirmations...");
    await contract.deploymentTransaction().wait(NETWORK === "sepolia" ? 5 : 1);
    console.log("Contract deployment confirmed!");
    
    const owner = await contract.owner();
    console.log("Contract owner:", owner);
    console.log("Deployer address:", wallet.address);
    console.log("Owner matches deployer:", owner.toLowerCase() === wallet.address.toLowerCase());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });