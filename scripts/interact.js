
const { ethers } = require("ethers");
require("dotenv").config({ path: '../.env' });
const fs = require("fs");

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

  console.log("Loading environment variables...");
  console.log("POLYGON_RPC:", process.env.POLYGON_RPC ? "defined" : "undefined");
  console.log("PRIVATE_KEY:", process.env.PRIVATE_KEY ? "defined (length: " + process.env.PRIVATE_KEY.length + ")" : "undefined");
  console.log("CONTRACT_ADDRESS:", process.env.CONTRACT_ADDRESS ? "defined" : "undefined");
  
  if (!process.env.POLYGON_RPC || !process.env.PRIVATE_KEY || !process.env.CONTRACT_ADDRESS) {
    console.error("Missing required environment variables");
    process.exit(1);
  }
  
  try {

    const privateKey = process.env.PRIVATE_KEY.startsWith("0x") 
      ? process.env.PRIVATE_KEY 
      : `0x${process.env.PRIVATE_KEY}`;
    
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log("Wallet address:", wallet.address);
    
    const contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS, 
      contractABI, 
      wallet
    );
    
    const segmentHash = ethers.keccak256(ethers.toUtf8Bytes("test_segment"));
    const vrfFingerprint = ethers.keccak256(ethers.toUtf8Bytes("test_fingerprint"));
    
    console.log("⌛ Storing fingerprint...");
    const tx = await contract.storeFingerprint(segmentHash, vrfFingerprint);
    await tx.wait();
    console.log("✅ Fingerprint stored successfully.");
    
    console.log("⌛ Verifying fingerprint...");
    const isValid = await contract.verifyFingerprint(segmentHash, vrfFingerprint);
    console.log("🛡️ Verification result:", isValid);
  
  } catch (error) {
    console.error("❌ Error interacting with contract:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error.message);
    process.exit(1);
  });