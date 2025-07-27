const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const wallet = ethers.Wallet.createRandom();
const privateKey = wallet.privateKey;
const publicKey = wallet.publicKey;

console.log("Ethereum Private Key:", privateKey);
console.log("Ethereum Public Key:", publicKey);

const envPath = path.join(__dirname, "../.env"); 
const envContent = `VRF_SECRET_KEY="${privateKey}"\nVRF_PUBLIC_KEY="${publicKey}"\n`;

fs.appendFileSync(envPath, envContent, "utf8");
console.log("✅ Ethereum-compatible VRF keys generated and added to .env!");

