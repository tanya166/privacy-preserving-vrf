// interact.js - pure ethers v6 implementation (no Hardhat)
const { ethers } = require("ethers");
require("dotenv").config({ path: '../.env' });
const fs = require("fs");

// Read the ABI from the file directly
let contractABI;
try {
  const contractFile = fs.readFileSync("../artifacts/contracts/VRFStorage.sol/VRFStorage.json");
  const contractJson = JSON.parse(contractFile);
  contractABI = contractJson.abi;
} catch (error) {
  console.error("Error loading contract ABI:", error.message);
  process.exit(1);
}

async function main() {
  // Log environment variables (for debugging)
  console.log("Loading environment variables...");
  console.log("POLYGON_RPC:", process.env.POLYGON_RPC ? "defined" : "undefined");
  console.log("PRIVATE_KEY:", process.env.PRIVATE_KEY ? "defined (length: " + process.env.PRIVATE_KEY.length + ")" : "undefined");
  console.log("CONTRACT_ADDRESS:", process.env.CONTRACT_ADDRESS ? "defined" : "undefined");
  
  if (!process.env.POLYGON_RPC || !process.env.PRIVATE_KEY || !process.env.CONTRACT_ADDRESS) {
    console.error("Missing required environment variables");
    process.exit(1);
  }
  
  try {
    // Format private key correctly (add 0x prefix if needed)
    const privateKey = process.env.PRIVATE_KEY.startsWith("0x") 
      ? process.env.PRIVATE_KEY 
      : `0x${process.env.PRIVATE_KEY}`;
    
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log("Wallet address:", wallet.address);
    
    // Connect to the contract
    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS, 
      contractABI, 
      wallet
    );
    
    // Generate test data
    const segmentHash = ethers.keccak256(ethers.toUtf8Bytes("test_segment"));
    const vrfFingerprint = ethers.keccak256(ethers.toUtf8Bytes("test_fingerprint"));
    
    // Store Fingerprint
    console.log("⌛ Storing fingerprint...");
    const tx = await contract.storeFingerprint(segmentHash, vrfFingerprint);
    await tx.wait();
    console.log("✅ Fingerprint stored successfully.");
    
    // Verify Fingerprint
    console.log("⌛ Verifying fingerprint...");
    const isValid = await contract.verifyFingerprint(segmentHash, vrfFingerprint);
    console.log("🛡️ Verification result:", isValid);
  
  } catch (error) {
    console.error("❌ Error interacting with contract:", error.message);
  }
}

// Execute the main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error.message);
    process.exit(1);
  });