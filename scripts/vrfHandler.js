require("dotenv").config({ path: "../.env" });
const fs = require("fs");
const { Wallet, keccak256, toUtf8Bytes } = require("ethers");
const { getBytes } = require("ethers");

function loadPrivateKey() {
  if (!process.env.VRF_SECRET_KEY) {
    throw new Error("❌ VRF_SECRET_KEY is missing in .env!");
  }
  return process.env.VRF_SECRET_KEY;
}

function generateVRFKeys() {
  const privateKey = loadPrivateKey();
  const wallet = new Wallet(privateKey);
  return {
    privateKey: wallet.privateKey,
    publicKey: wallet.address
    
  };
}

async function computeVRF(segmentData, privateKey) {
  const wallet = new Wallet(privateKey);
  const messageHash = keccak256(toUtf8Bytes(JSON.stringify(segmentData)));
  const signature = await wallet.signMessage(getBytes(messageHash));
  return {
    segmentHash: messageHash,
    fingerprint: signature
  };
}


async function generateVRF(segmentData) {
  const { privateKey } = generateVRFKeys();
  const { segmentHash, fingerprint } = await computeVRF(segmentData, privateKey);
  return {
    segmentHash,
    fingerprint,
    secretKey: privateKey
  };
}

if (require.main === module) {
  const threshold = 30;
  const data = JSON.parse(fs.readFileSync("data.json"));

  (async () => {
    console.log("✅ Fingerprints of entries > 30°C:\n");
    for (const entry of data) {
      if (entry.temp > threshold) {
        const { segmentHash, fingerprint } = await generateVRF(entry);
        console.log({ segmentHash, fingerprint });
      }
    }
  })().catch(console.error);
}

module.exports = {
  generateVRF
};
