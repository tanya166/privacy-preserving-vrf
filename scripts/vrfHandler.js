require("dotenv").config({ path: "../.env" });
const fs = require("fs");
const { Wallet, keccak256, toUtf8Bytes, verifyMessage } = require("ethers");
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
    fingerprint: signature,
    signerAddress: wallet.address
  };
}
async function generateVRF(segmentData) {
  const { privateKey } = generateVRFKeys();
  const { segmentHash, fingerprint, signerAddress } = await computeVRF(segmentData, privateKey);
  return {
    segmentHash,
    fingerprint,
    secretKey: privateKey,
    signerAddress
  };
}

async function generateVRFWithKey(segmentData, userPrivateKey) {
  try {
   
    if (!userPrivateKey || typeof userPrivateKey !== 'string') {
      throw new Error("Private key must be a valid string");
    }
    
    const formattedKey = userPrivateKey.startsWith('0x') ? userPrivateKey : `0x${userPrivateKey}`;
   
    if (formattedKey.length !== 66) {
      throw new Error("Private key must be 64 hex characters (with or without 0x prefix)");
    }
    
    const testWallet = new Wallet(formattedKey);
    
    const { segmentHash, fingerprint, signerAddress } = await computeVRF(segmentData, formattedKey);
    
    return {
      segmentHash,
      fingerprint,
      secretKey: formattedKey, 
      walletAddress: signerAddress
    };
    
  } catch (error) {
    throw new Error(`Failed to generate VRF with user key: ${error.message}`);
  }
}


async function createVRFRecord(segmentData, userPrivateKey) {
  try {
    const { segmentHash, fingerprint, walletAddress } = await generateVRFWithKey(segmentData, userPrivateKey);
  
    const keyHash = keccak256(toUtf8Bytes(userPrivateKey));
    
    return {
      segmentHash,
      fingerprint,
      signerAddress: walletAddress,
      keyHash, 
      dataString: JSON.stringify(segmentData),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    throw new Error(`Failed to create VRF record: ${error.message}`);
  }
}


function compareVRFResults(result1, result2) {
  return {
    hashMatch: result1.segmentHash === result2.segmentHash,
    signatureMatch: result1.fingerprint === result2.fingerprint,
    addressMatch: result1.walletAddress === result2.walletAddress,
    fullMatch: result1.segmentHash === result2.segmentHash && 
              result1.fingerprint === result2.fingerprint && 
              result1.walletAddress === result2.walletAddress
  };
}

async function verifyOwnClaim(segmentData, userPrivateKey) {
  try {
    
    const { segmentHash, fingerprint, walletAddress } = await generateVRFWithKey(segmentData, userPrivateKey);
    
    
    const result = await verifyClaim(segmentData, walletAddress, fingerprint);
    
    if (result.found) {
      return {
        verified: true,
        segmentHash,
        fingerprint,
        walletAddress,
        message: 'Successfully verified your claim exists in the database'
      };
    } else {
      return {
        verified: false,
        segmentHash,
        fingerprint,
        walletAddress,
        message: 'Your claim was not found in the database'
      };
    }
    
  } catch (error) {
    return {
      verified: false,
      error: error.message,
      message: 'Failed to verify your claim'
    };
  }
}


async function storeVRFRecord(segmentData, userPrivateKey) {
  try {
    const pool = require('../backend/database');
    
    const record = await createVRFRecord(segmentData, userPrivateKey);
   
    const query = `
      INSERT INTO time_series_vrf (
        segment_hash, 
        vrf_fingerprint, 
        signer_address, 
        key_hash,
        data_string,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `;
    
    const params = [
      record.segmentHash,
      record.fingerprint,
      record.signerAddress,
      record.keyHash,
      record.dataString,
      record.timestamp
    ];
    
    const result = await pool.query(query, params);
    
    return {
      success: true,
      id: result.rows[0].id,
      segmentHash: record.segmentHash,
      fingerprint: record.fingerprint,
      signerAddress: record.signerAddress,
      keyHash: record.keyHash,
      timestamp: result.rows[0].created_at
    };
    
  } catch (error) {
    throw new Error(`Failed to store VRF record: ${error.message}`);
  }
}

function getWalletAddress(privateKey) {
  try {
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const wallet = new Wallet(formattedKey);
    return wallet.address;
  } catch (error) {
    throw new Error(`Invalid private key: ${error.message}`);
  }
}

function validatePrivateKey(privateKey) {
  try {
    if (!privateKey || typeof privateKey !== 'string') {
      return { valid: false, error: "Private key must be a valid string" };
    }
    
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    
    if (formattedKey.length !== 66) {
      return { valid: false, error: "Private key must be 64 hex characters (with or without 0x prefix)" };
    }
   
    const wallet = new Wallet(formattedKey);
    
    return { 
      valid: true, 
      formattedKey,
      address: wallet.address 
    };
    
  } catch (error) {
    return { 
      valid: false, 
      error: `Invalid private key: ${error.message}` 
    };
  }
}

if (require.main === module) {
  const threshold = 30;
  
  const dataFile = "data.json";
  if (!fs.existsSync(dataFile)) {
    console.error("❌ data.json file not found!");
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(dataFile));

  (async () => {
    console.log("✅ Secure VRF fingerprints of entries > 30°C:\n");
    console.log("🔒 Private keys are NEVER stored in database\n");
    
    if (process.env.VRF_SECRET_KEY) {
      console.log("Using VRF key from environment (.env file)\n");
      
      for (const entry of data) {
        if (entry.temp > threshold) {
          const { segmentHash, fingerprint, signerAddress } = await generateVRF(entry);
          console.log({ 
            entry, 
            segmentHash: segmentHash.substring(0, 10) + '...', 
            fingerprint: fingerprint.substring(0, 10) + '...',
            signerAddress
          });
        }
      }
    } else {
      console.log("No VRF_SECRET_KEY found in .env file.");
      console.log("Example usage with user-provided key:\n");
      
      const randomWallet = Wallet.createRandom();
      const exampleKey = randomWallet.privateKey;
      
      console.log(`Example VRF Private Key: ${exampleKey}`);
      console.log(`Corresponding Address: ${randomWallet.address}\n`);
      
      for (const entry of data) {
        if (entry.temp > threshold) {
          const { segmentHash, fingerprint, walletAddress } = await generateVRFWithKey(entry, exampleKey);
          console.log({ 
            entry, 
            segmentHash: segmentHash.substring(0, 10) + '...', 
            fingerprint: fingerprint.substring(0, 10) + '...',
            walletAddress
          });
        }
      }
    }
  })().catch(console.error);
}

module.exports = {
  generateVRF,              
  generateVRFWithKey,       
  compareVRFResults,       
  validatePrivateKey,      
  getWalletAddress,        
  computeVRF              
};