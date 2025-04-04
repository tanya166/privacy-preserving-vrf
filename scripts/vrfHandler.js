require("dotenv").config({ path: "../.env" });
const { Wallet, keccak256, toUtf8Bytes } = require("ethers");
// Import getBytes which replaces arrayify in v6
const { getBytes } = require("ethers");

// 🔹 Load Private Key from .env
function loadPrivateKey() {
  if (!process.env.VRF_SECRET_KEY) {
    throw new Error("❌ VRF_SECRET_KEY is missing in .env!");
  }
  return process.env.VRF_SECRET_KEY;
}

console.log("VRF_SECRET_KEY from .env:", process.env.VRF_SECRET_KEY); // Debugging line

// 🔹 Generate VRF Keys
function generateVRFKeys() {
  const privateKey = loadPrivateKey(); // Load from .env
  const wallet = new Wallet(privateKey);
  return {
    privateKey: wallet.privateKey,
    publicKey: wallet.address
  };
}

// 🔹 Compute VRF Signature
async function computeVRF(segmentData, privateKey) {
  const wallet = new Wallet(privateKey);
  const messageHash = keccak256(toUtf8Bytes(JSON.stringify(segmentData)));
  // Use getBytes instead of arrayify
  const signature = await wallet.signMessage(getBytes(messageHash));
  return {
    segmentHash: messageHash,
    fingerprint: signature
  };
}

// 🔹 Main Function to Generate VRF Output
async function generateVRF(segmentData) {
  const { privateKey, publicKey } = generateVRFKeys();
  const { segmentHash, fingerprint } = await computeVRF(segmentData, privateKey);
  return {
    segmentHash,
    fingerprint,
    publicKey
  };
}

// 🔹 Example Usage
if (require.main === module) {
  const sampleData = {
    temperature: 25.3,
    humidity: 80
  };
  generateVRF(sampleData).then(console.log).catch(console.error);
}

module.exports = {
  generateVRF
};