const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Generate Ethereum-compatible VRF private key
const wallet = ethers.Wallet.createRandom();
const privateKey = wallet.privateKey;
const publicKey = wallet.publicKey;

// Print the keys to the console
console.log("Ethereum Private Key:", privateKey);
console.log("Ethereum Public Key:", publicKey);

// Append VRF_SECRET_KEY to .env file
const envPath = path.join(__dirname, "../.env"); // Adjust path if needed
const envContent = `VRF_SECRET_KEY="${privateKey}"\nVRF_PUBLIC_KEY="${publicKey}"\n`;

fs.appendFileSync(envPath, envContent, "utf8");
console.log("✅ Ethereum-compatible VRF keys generated and added to .env!");

